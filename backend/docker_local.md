# Backend Docker (local)

## Build

```bash
cd backend
docker build -t edu-kernel-backend .
```

## Run

```bash
cd backend
docker run --rm -p 8000:8000 --env-file .env edu-kernel-backend
```

## Check

```bash
curl http://localhost:8000/users/me
```

Expected without token: `401` (backend is running).
