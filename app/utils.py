import numpy as np
from typing import List

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Computes the cosine similarity between two 1D lists of floats."""
    if not a or not b:
        return 0.0
    vec_a = np.array(a, dtype=np.float32)
    vec_b = np.array(b, dtype=np.float32)
    
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
        
    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))

def chunk_text(text: str, max_chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """Splits raw text into sliding chunks, preserving word boundaries."""
    if not text:
        return []
        
    words = text.split()
    chunks = []
    
    current_chunk_words = []
    current_length = 0
    
    for word in words:
        current_chunk_words.append(word)
        current_length += len(word) + 1  # include space
        
        if current_length >= max_chunk_size:
            chunks.append(" ".join(current_chunk_words))
            
            # Form overlap: take last 'overlap' characters worth of words
            overlap_words = []
            overlap_length = 0
            for w in reversed(current_chunk_words):
                if overlap_length + len(w) + 1 > overlap:
                    break
                overlap_words.insert(0, w)
                overlap_length += len(w) + 1
                
            current_chunk_words = overlap_words
            current_length = overlap_length
            
    if current_chunk_words:
        chunks.append(" ".join(current_chunk_words))
        
    return chunks
