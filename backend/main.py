# =============================================================
#  Family Registry — FastAPI Backend
#  File: backend/main.py
# =============================================================

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import (
    create_engine, Column, String, Date, Enum as SAEnum,
    Text, Integer, DateTime, ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from sqlalchemy.sql import func
from jose import JWTError, jwt
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date, timedelta
import uuid
import os
import bcrypt
from dotenv import load_dotenv

load_dotenv()

# ── Configuration ─────────────────────────────────────────────────────────────
DB_USER     = os.getenv("DB_USER",     "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = os.getenv("DB_PORT",     "3306")
DB_NAME     = os.getenv("DB_NAME",     "family_registry")

DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
)

SECRET_KEY  = os.getenv("SECRET_KEY", "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET")
ALGORITHM   = "HS256"
TOKEN_EXPIRE_DAYS = 7

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "family@admin123")

# ── Database Setup ────────────────────────────────────────────────────────────
engine       = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── ORM Models ────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id            = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    name          = Column(String(255), nullable=False)
    username      = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    dob           = Column(Date,        nullable=True)
    gender        = Column(SAEnum("Male", "Female", "Other"), default="Male")
    generation    = Column(Integer,     nullable=False, default=1)
    about         = Column(Text,        nullable=True)
    photo         = Column(Text,        nullable=True)   # base64 encoded image
    status        = Column(SAEnum("pending", "approved", "rejected"), default="pending")
    registered_at = Column(DateTime,    default=func.now())
    updated_at    = Column(DateTime,    default=func.now(), onupdate=func.now())

    relations_from = relationship(
        "Relation",
        foreign_keys="Relation.member_id",
        back_populates="member",
        cascade="all, delete-orphan",
    )


class Relation(Base):
    __tablename__ = "relations"
    __table_args__ = (
        UniqueConstraint("member_id", "related_member_id", name="uq_relation"),
    )

    id                = Column(Integer,     primary_key=True, autoincrement=True)
    member_id         = Column(String(36),  ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    related_member_id = Column(String(36),  ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    relation_type     = Column(String(50),  nullable=False)
    created_at        = Column(DateTime,    default=func.now())

    member         = relationship("User", foreign_keys=[member_id], back_populates="relations_from")
    related_member = relationship("User", foreign_keys=[related_member_id])


# Create all tables (if they don't exist yet)
Base.metadata.create_all(bind=engine)


# ── Auth Utilities ────────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode("utf-8")[:72]
    return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))


def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        role: str    = payload.get("role")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user_id, "role": role}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")


def require_admin(current_user: dict = Depends(decode_token)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_logged_in(current_user: dict = Depends(decode_token)):
    return current_user


# ── Pydantic Schemas ──────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name:       str
    username:   str
    password:   str
    dob:        Optional[str] = None
    gender:     str           = "Male"
    generation: int           = 1
    about:      Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_length(cls, v):
        if len(v.strip()) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("generation")
    @classmethod
    def generation_range(cls, v):
        if not 1 <= v <= 5:
            raise ValueError("Generation must be between 1 and 5")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class UpdateProfileRequest(BaseModel):
    name:       Optional[str] = None
    dob:        Optional[str] = None
    gender:     Optional[str] = None
    generation: Optional[int] = None
    about:      Optional[str] = None
    photo:      Optional[str] = None   # base64 encoded image


class RelationRequest(BaseModel):
    related_member_id: str
    relation_type:     str


class MessageResponse(BaseModel):
    message: str


# ── Helper: serialise User → dict ─────────────────────────────────────────────
def user_to_dict(user: User, db: Session) -> dict:
    rels = {}
    for r in db.query(Relation).filter(Relation.member_id == user.id).all():
        rels[r.related_member_id] = r.relation_type

    return {
        "id":           user.id,
        "name":         user.name,
        "username":     user.username,
        "dob":          user.dob.isoformat() if user.dob else None,
        "gender":       user.gender,
        "generation":   user.generation,
        "about":        user.about,
        "photo":        user.photo,
        "status":       user.status,
        "registered_at": user.registered_at.isoformat() if user.registered_at else "",
        "relations":    rels,
    }


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Family Registry API",
    version="1.0.0",
    description="Self-hosted family registry with MySQL backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # restrict to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "message": "Family Registry API is running"}


# ── Auth Routes ───────────────────────────────────────────────────────────────
@app.post("/auth/login", tags=["Auth"])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Admin shortcut (no DB record needed)
    if req.username == ADMIN_USERNAME and req.password == ADMIN_PASSWORD:
        token = create_token({"sub": "admin", "role": "admin"})
        return {"access_token": token, "token_type": "bearer", "role": "admin", "user": None}

    user = db.query(User).filter(User.username == req.username.strip()).first()
    if not user:
        raise HTTPException(status_code=401, detail="Username not found")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong password")
    if user.status == "pending":
        raise HTTPException(status_code=403, detail="Account pending admin approval")
    if user.status == "rejected":
        raise HTTPException(status_code=403, detail="Registration was rejected by admin")

    token = create_token({"sub": user.id, "role": "member"})
    return {
        "access_token": token,
        "token_type":   "bearer",
        "role":         "member",
        "user":         user_to_dict(user, db),
    }


@app.post("/auth/register", status_code=201, tags=["Auth"])
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        id            = str(uuid.uuid4()),
        name          = req.name.strip(),
        username      = req.username,
        password_hash = hash_password(req.password),
        dob           = date.fromisoformat(req.dob) if req.dob else None,
        gender        = req.gender,
        generation    = req.generation,
        about         = req.about,
        status        = "pending",
    )
    db.add(user)
    db.commit()
    return {"message": "Registration submitted. Waiting for admin approval."}


# ── Admin Routes ──────────────────────────────────────────────────────────────
@app.get("/admin/users", tags=["Admin"])
def admin_list_users(
    status: Optional[str] = None,
    _:  dict    = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if status:
        q = q.filter(User.status == status)
    return [user_to_dict(u, db) for u in q.order_by(User.registered_at.desc()).all()]


@app.put("/admin/users/{user_id}/approve", tags=["Admin"])
def admin_approve(user_id: str, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "approved"
    db.commit()
    return {"message": f"{user.name} approved"}


@app.put("/admin/users/{user_id}/reject", tags=["Admin"])
def admin_reject(user_id: str, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "rejected"
    db.commit()
    return {"message": f"{user.name} rejected"}


@app.delete("/admin/users/{user_id}", tags=["Admin"])
def admin_delete(user_id: str, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "Member deleted"}


@app.put("/admin/users/{user_id}", tags=["Admin"])
def admin_update_user(
    user_id: str,
    req: UpdateProfileRequest,
    _:  dict    = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _apply_profile_update(user, req)
    db.commit()
    return user_to_dict(user, db)


# ── Member Routes ─────────────────────────────────────────────────────────────
@app.get("/members", tags=["Members"])
def list_members(
    current_user: dict    = Depends(require_logged_in),
    db:           Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.status == "approved")
        .order_by(User.generation, User.name)
        .all()
    )
    return [user_to_dict(u, db) for u in users]


@app.get("/members/me", tags=["Members"])
def get_me(current_user: dict = Depends(require_logged_in), db: Session = Depends(get_db)):
    if current_user["role"] == "admin":
        return {"id": "admin", "name": "Admin", "role": "admin"}
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_dict(user, db)


@app.put("/members/me", tags=["Members"])
def update_me(
    req:          UpdateProfileRequest,
    current_user: dict    = Depends(require_logged_in),
    db:           Session = Depends(get_db),
):
    if current_user["role"] == "admin":
        raise HTTPException(status_code=400, detail="Admin profile is fixed")
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _apply_profile_update(user, req)
    db.commit()
    return user_to_dict(user, db)


@app.post("/members/{member_id}/relations", tags=["Relations"])
def add_relation(
    member_id:    str,
    req:          RelationRequest,
    current_user: dict    = Depends(require_logged_in),
    db:           Session = Depends(get_db),
):
    _assert_can_manage_relations(member_id, current_user)

    existing = (
        db.query(Relation)
        .filter(
            Relation.member_id         == member_id,
            Relation.related_member_id == req.related_member_id,
        )
        .first()
    )
    if existing:
        existing.relation_type = req.relation_type
    else:
        db.add(Relation(
            member_id         = member_id,
            related_member_id = req.related_member_id,
            relation_type     = req.relation_type,
        ))
    db.commit()
    return {"message": "Relation saved"}


@app.delete("/members/{member_id}/relations/{related_id}", tags=["Relations"])
def remove_relation(
    member_id:    str,
    related_id:   str,
    current_user: dict    = Depends(require_logged_in),
    db:           Session = Depends(get_db),
):
    _assert_can_manage_relations(member_id, current_user)

    rel = (
        db.query(Relation)
        .filter(
            Relation.member_id         == member_id,
            Relation.related_member_id == related_id,
        )
        .first()
    )
    if not rel:
        raise HTTPException(status_code=404, detail="Relation not found")
    db.delete(rel)
    db.commit()
    return {"message": "Relation removed"}


# ── Private Helpers ───────────────────────────────────────────────────────────
def _apply_profile_update(user: User, req: UpdateProfileRequest):
    if req.name       is not None: user.name       = req.name.strip()
    if req.gender     is not None: user.gender     = req.gender
    if req.generation is not None: user.generation = req.generation
    if req.about      is not None: user.about      = req.about
    if req.photo      is not None: user.photo      = req.photo
    if req.dob        is not None:
        user.dob = date.fromisoformat(req.dob) if req.dob else None


def _assert_can_manage_relations(member_id: str, current_user: dict):
    if current_user["role"] == "admin":
        return
    if current_user["id"] != member_id:
        raise HTTPException(
            status_code=403,
            detail="You can only manage your own relations",
        )