from typing import BinaryIO

import mimetypes

from ..config import get_settings

settings = get_settings()


def storage_enabled() -> bool:
    return bool(
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.AWS_ENDPOINT_URL_S3
    )


def _client():
    from botocore.config import Config

    import boto3

    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        endpoint_url=settings.AWS_ENDPOINT_URL_S3,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        config=Config(s3={"addressing_style": "path"}),
    )


def public_url(key: str) -> str:
    return f"{settings.AWS_ENDPOINT_URL_S3}/{settings.STORAGE_BUCKET}/{key}"


def put_object(key: str, body: BinaryIO, content_type: str) -> str:
    _client().put_object(
        Bucket=settings.STORAGE_BUCKET,
        Key=key,
        Body=body,
        ContentType=content_type,
        CacheControl="max-age=31536000",
    )
    return public_url(key)


def key_from_url(url: str) -> str | None:
    prefix = f"{settings.AWS_ENDPOINT_URL_S3}/{settings.STORAGE_BUCKET}/"
    if url.startswith(prefix):
        return url[len(prefix):].split("?")[0]
    return None


def read_object(key: str) -> tuple[BinaryIO, str]:
    """Stream a stored object back to an authenticated caller."""
    client = _client()
    head = client.head_object(Bucket=settings.STORAGE_BUCKET, Key=key)
    content_type = (
        head.get("ContentType")
        or mimetypes.guess_type(key)[0]
        or "application/octet-stream"
    )
    body = client.get_object(Bucket=settings.STORAGE_BUCKET, Key=key)["Body"]
    return body, content_type


def delete_by_url(url: str) -> None:
    key = key_from_url(url)
    if not key:
        return
    try:
        _client().delete_object(Bucket=settings.STORAGE_BUCKET, Key=key)
    except Exception:
        pass