FROM python:3.12-slim-bookworm
RUN groupadd --gid 1000 node && useradd --uid 1000 --gid node --no-create-home node
COPY server/python-execution/runner.py /runner.py
USER node
ENV PYTHONDONTWRITEBYTECODE=1
ENTRYPOINT ["python3", "-I", "-S", "/runner.py"]
