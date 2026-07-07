<!-- cmd to run -->

cd backend-python
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
python -m uvicorn app.server:app --reload --host 0.0.0.0 --port 8000