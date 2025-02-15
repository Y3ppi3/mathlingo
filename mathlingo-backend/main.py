from fastapi import FastAPI
from app.routes import users

app = FastAPI()

app.include_router(users.router, prefix="/api", tags=["users"])

@app.get("/")
def home():
    return {"message": "Добро пожаловать в MathLingo API!"}
