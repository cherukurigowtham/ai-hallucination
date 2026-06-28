import uvicorn
from fastapi import FastAPI, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from zguard import zguard_middleware, ZGuardContext, GroundingSource

app = FastAPI(title="Z-Guard Python Example")

# 1. Mock grounding sources (Knowledge Base)
sources: List[GroundingSource] = [
    {
        "id": "doc_01",
        "content": "Acme Corp Q1 revenue was 15.4 million dollars, representing a 12 percent growth year-over-year."
    }
]

# 2. Target tool call schema using Pydantic
class SendEmailSchema(BaseModel):
    to: str = Field(..., pattern=r"^.+@.+\..+$")
    subject: str
    body: Optional[str] = None

# Inject zGuard middleware context as a route dependency
zguard_dep = zguard_middleware(sources=sources)

@app.post("/verify")
async def verify_output(request: Request, body: dict, zguard: ZGuardContext = Depends(zguard_dep)):
    text = body.get("text", "")
    
    # Run the parallel verification checks (claims + schema validation)
    result = await zguard.verify(text, schema=SendEmailSchema)
    
    if not result["isValid"]:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Hallucination Detected",
                "critiques": result["critiques"],
                "actionableErrors": result["actionableErrors"]
            }
        )
        
    return {
        "status": "success",
        "message": "Factual consistency and execution schema successfully verified.",
        "critiques": result["critiques"]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
