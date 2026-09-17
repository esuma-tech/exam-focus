from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import AnalyticsEvent, Course, Enrollment, Forum, ForumComment, ForumPost, User
from ..schemas import ForumCommentIn, ForumCommentOut, ForumOut, ForumPostIn, ForumPostOut

router = APIRouter(prefix="/forums", tags=["forums"])


def _post_out(post: ForumPost) -> ForumPostOut:
    return ForumPostOut(
        id=post.id, title=post.title, body=post.body, is_pinned=post.is_pinned,
        is_announcement=post.is_announcement, created_at=post.created_at,
        author=post.author, comments=post.comments,
    )


@router.get("", response_model=list[ForumOut])
def list_forums(course_id: int, db: Session = Depends(get_db)):
    return db.query(Forum).filter(Forum.course_id == course_id).all()


@router.get("/{forum_id}", response_model=list[ForumPostOut])
def forum_posts(forum_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    forum = db.get(Forum, forum_id)
    if not forum:
        raise HTTPException(status_code=404, detail="Forum not found")
    if current.role == "learner":
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.user_id == current.id, Enrollment.course_id == forum.course_id)
            .first()
        )
        if not enrolled:
            raise HTTPException(status_code=403, detail="Enroll to access this forum")
    posts = (
        db.query(ForumPost)
        .options(selectinload(ForumPost.author), selectinload(ForumPost.comments).selectinload(ForumComment.author))
        .filter(ForumPost.forum_id == forum_id)
        .order_by(ForumPost.is_pinned.desc(), ForumPost.created_at.desc())
        .all()
    )
    return [_post_out(p) for p in posts]


@router.post("/{forum_id}/posts", response_model=ForumPostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    forum_id: int,
    payload: ForumPostIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    forum = db.get(Forum, forum_id)
    if not forum:
        raise HTTPException(status_code=404, detail="Forum not found")
    if current.role == "learner":
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.user_id == current.id, Enrollment.course_id == forum.course_id)
            .first()
        )
        if not enrolled:
            raise HTTPException(status_code=403, detail="Enroll to post in this forum")

    post = ForumPost(
        forum_id=forum_id,
        author_id=current.id,
        title=payload.title,
        body=payload.body,
        is_pinned=payload.is_pinned if current.role != "learner" else False,
        is_announcement=payload.is_announcement if current.role != "learner" else False,
    )
    db.add(post)
    db.add(AnalyticsEvent(event_name="forum.post_created", entity="forum", entity_id=forum_id, user_id=current.id))
    db.commit()
    post = db.query(ForumPost).options(selectinload(ForumPost.author)).filter(ForumPost.id == post.id).first()
    return _post_out(post)


@router.post("/posts/{post_id}/comments", response_model=ForumCommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    payload: ForumCommentIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    comment = ForumComment(post_id=post_id, author_id=current.id, body=payload.body)
    db.add(comment)
    db.commit()
    comment = (
        db.query(ForumComment)
        .options(selectinload(ForumComment.author))
        .filter(ForumComment.id == comment.id)
        .first()
    )
    return comment


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    post = db.get(ForumPost, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if current.role != "admin" and post.author_id != current.id:
        raise HTTPException(status_code=403, detail="Not your post")
    db.delete(post)
    db.commit()