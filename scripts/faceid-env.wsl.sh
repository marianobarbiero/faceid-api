# Environment for running faceid-api with TensorFlow on the GPU inside WSL.
# Usage: source ~/faceid-env.sh

# Keep Windows PATH entries out: they break pip/python lookups (e.g. /mnt/c/DATA)
export PATH=/usr/local/bin:/usr/bin:/bin

VENV="$HOME/venvs/faceid"
NV="$VENV/lib/python3.10/site-packages/nvidia"

# TensorFlow's pip CUDA wheels don't put every library on its search path (libcusolver)
LD_LIBRARY_PATH=""
for d in "$NV"/*/lib; do LD_LIBRARY_PATH="$LD_LIBRARY_PATH:$d"; done
export LD_LIBRARY_PATH="${LD_LIBRARY_PATH#:}"

export TF_CPP_MIN_LOG_LEVEL=2
# Reuse the model weights already downloaded on Windows (~2.3 GB) instead of a second copy
# export DEEPFACE_HOME=/mnt/c/Users/<windows-user>

# Allocate GPU memory on demand instead of grabbing all 6 GB up front
export TF_FORCE_GPU_ALLOW_GROWTH=true

source "$VENV/bin/activate"
