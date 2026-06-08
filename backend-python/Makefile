.PHONY: dev test lint format migrate upgrade downgrade worker

dev:
	python3 -m uvicorn app.server:app --reload --port 8000

dev-socket:
	python3 -m uvicorn app.server:app --reload --port 8000

test:
	pytest tests/ -v --cov=app --cov-report=term-missing

lint:
	ruff check app/ tests/

format:
	ruff format app/ tests/

typecheck:
	mypy app/

# Alembic
migrate:
	alembic revision --autogenerate -m "$(msg)"

upgrade:
	alembic upgrade head

downgrade:
	alembic downgrade -1

baseline:
	alembic stamp head

# Celery workers
worker:
	python3 -m celery -A app.workers.celery_app worker --loglevel=info

beat:
	python3 -m celery -A app.workers.celery_app beat --loglevel=info

install:
	pip3 install -r requirements.txt
