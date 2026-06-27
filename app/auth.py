from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

security = HTTPBearer()

def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    """Optional JWT/Bearer Authentication simulation for API requests."""
    if not credentials:
        return None
        
    token = credentials.credentials
    if token == "mock-dev-token":
        return {"id": "dev_user", "role": "admin", "name": "Developer"}
        
    # Return a basic mock user payload
    return {"id": "user_1", "role": "user", "name": "Document Explorer"}

def get_current_user_required(user = Depends(get_current_user_optional)) -> dict:
    """Enforced Authentication check."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials are required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
