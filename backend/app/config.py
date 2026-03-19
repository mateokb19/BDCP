from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:password@localhost:5432/bdcpolo"

    model_config = {"env_file": ".env"}


settings = Settings()
