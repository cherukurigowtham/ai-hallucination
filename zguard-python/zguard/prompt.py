from typing import Type
from pydantic import BaseModel

def generate_tool_instructions(name: str, schema: Type[BaseModel]) -> str:
    """
    Translates a Pydantic BaseModel schema into precise system prompt formatting instructions.
    """
    fields = []
    
    # Support Pydantic v2 and v1 dynamically
    if hasattr(schema, "model_fields"):
        # Pydantic v2
        for key, field in schema.model_fields.items():
            type_name = "any"
            is_optional = not field.is_required()
            
            anno = field.annotation
            if anno:
                # Handle typing.Optional/Union wrappers
                if hasattr(anno, "__origin__"):
                    import typing
                    if anno.__origin__ is typing.Union:
                        args = anno.__args__
                        non_none_args = [a for a in args if a is not type(None)]
                        if non_none_args:
                            anno = non_none_args[0]
                            is_optional = True
                            
                if hasattr(anno, "__name__"):
                    type_name = anno.__name__
                else:
                    type_name = str(anno)
            
            description = ""
            if field.description:
                description = f" - {field.description}"
                
            fields.append(f'"{key}": <{type_name}>{ " [Optional]" if is_optional else "" }{description}')
    else:
        # Pydantic v1 fallback
        for key, field in schema.__fields__.items():
            type_name = field.type_.__name__ if hasattr(field.type_, "__name__") else str(field.type_)
            is_optional = not field.required
            description = f" - {field.field_info.description}" if field.field_info.description else ""
            fields.append(f'"{key}": <{type_name}>{ " [Optional]" if is_optional else "" }{description}')
            
    fields_str = ",\n  ".join(fields)
    
    return f"""To invoke the tool "{name}", you MUST append the following block to your response:
<tool name="{name}">
{{
  {fields_str}
}}
</tool>

Strict formatting rule: Output ONLY the XML tags and JSON content for tool calls as shown. Do not wrap in markdown code blocks."""
