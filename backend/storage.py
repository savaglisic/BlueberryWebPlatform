import json
import os
from minio import Minio
from minio.error import S3Error

BUCKET = "panel-videos"

_PUBLIC_READ_POLICY = json.dumps({
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {"AWS": ["*"]},
        "Action": ["s3:GetObject"],
        "Resource": [f"arn:aws:s3:::{BUCKET}/*"],
    }],
})

_client: Minio | None = None


def get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            os.environ.get("MINIO_ENDPOINT", "minio:9000"),
            access_key=os.environ.get("MINIO_ACCESS_KEY", "minioadmin"),
            secret_key=os.environ.get("MINIO_SECRET_KEY", "minioadmin"),
            secure=False,
        )
        try:
            if not _client.bucket_exists(BUCKET):
                _client.make_bucket(BUCKET)
            _client.set_bucket_policy(BUCKET, _PUBLIC_READ_POLICY)
        except S3Error:
            pass
    return _client


def upload_video(data: bytes, object_name: str) -> None:
    import io
    client = get_client()
    client.put_object(
        BUCKET,
        object_name,
        io.BytesIO(data),
        length=len(data),
        content_type="video/webm",
    )
