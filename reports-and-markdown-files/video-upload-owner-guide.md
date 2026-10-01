# Uploading course videos

Use http://localhost:8080 and the existing ADMIN test account. The actual demonstration video is already published and watchable with the student test account.

1. Open ADMIN courses and create or edit a course. Complete its Arabic and English text, grade, school year and term.
2. Add a section, then a lesson. Choose the MP4 in the lesson's video uploader and register/upload it. Keep the page open until upload completion.
3. Allow the external video service to process it; synchronize the video status until READY. Uploading a file alone does not publish a course.
4. Set the price and access rule: a duration, a fixed deadline, or access until permanent ADMIN removal. Complete the course's readiness steps and publish it.
5. Log in as a student, buy the course with test funds and open it from My Learning. For a package, unpublished members remain unavailable for watching until published.

## Where the video is stored

Cloudflare R2 stores the media; the separate DRM service uploads, processes and protects it. The platform stores API references and checks student access. Keep the bucket private and keep R2 credentials only in the DRM server configuration, never in browser code. Do not substitute a public raw MP4 link for the protected lesson.

For another environment, create/select a private bucket in Cloudflare's R2 dashboard, create Object Read & Write credentials restricted to that bucket, and configure the external DRM with its bucket, S3 endpoint, access key and secret. See [Cloudflare's S3 setup](https://developers.cloudflare.com/r2/get-started/s3/). Browser uploads need the exact website origin in the bucket's [CORS policy](https://developers.cloudflare.com/r2/buckets/cors/). Existing local 8080/8081 permissions are being reused; no R2 settings were changed. Once the production domain is selected, its exact origin must be configured and tested.

This local demonstration uses ClearKey. Production commercial DRM credentials and Railway qualification remain separate release requirements.
