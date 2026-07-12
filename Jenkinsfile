pipeline {

    agent {
        label 'flask-builder'
    }

    environment {
        FRONTEND_IMAGE = "questly-frontend"
        BACKEND_IMAGE  = "questly-backend"
        FRONTEND_CONTAINER = "questly-frontend-container"
        BACKEND_CONTAINER  = "questly-backend-container"
        NETWORK_NAME = "qnet"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout Source Code') {
            steps {
                git branch: 'feature',
                    url: 'https://github.com/Deepak8260/Questly-3-tier-app.git'
            }
        }

        stage('Cleanup') {
            steps {
                sh '''
                docker rm -f ${FRONTEND_CONTAINER} || true
                docker rm -f ${BACKEND_CONTAINER} || true

                docker rmi -f ${FRONTEND_IMAGE}:latest || true
                docker rmi -f ${FRONTEND_IMAGE}:${IMAGE_TAG} || true
                docker rmi -f ${BACKEND_IMAGE}:latest || true
                docker rmi -f ${BACKEND_IMAGE}:${IMAGE_TAG} || true

                docker image prune -af || true

                docker network inspect ${NETWORK_NAME} >/dev/null 2>&1 || docker network create ${NETWORK_NAME}
                '''
            }
        }

        stage('Build Frontend Image') {
            steps {
                withCredentials([
                    string(credentialsId: 'NEXT_PUBLIC_SUPABASE_URL', variable: 'NEXT_PUBLIC_SUPABASE_URL'),
                    string(credentialsId: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
                    string(credentialsId: 'NEXT_PUBLIC_API_BASE_URL', variable: 'NEXT_PUBLIC_API_BASE_URL'),
                    string(credentialsId: 'GEMINI_API_KEY', variable: 'GEMINI_API_KEY')
                ]) {
                    dir('frontend') {
                        sh '''
                        docker build \
                        --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
                        --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
                        --build-arg NEXT_PUBLIC_API_BASE_URL="$NEXT_PUBLIC_API_BASE_URL" \
                        --build-arg GEMINI_API_KEY="$GEMINI_API_KEY" \
                        -t ${FRONTEND_IMAGE}:${IMAGE_TAG} \
                        -f Dockerfile-new .
                        '''
                    }
                }
            }
        }

        stage('Build Backend Image') {
            steps {
                dir('backend') {
                    sh '''
                    docker build -t ${BACKEND_IMAGE}:${IMAGE_TAG} -f Dockerfile-new .
                    '''
                }
            }
        }

        stage('Run Backend Container') {
            steps {
                withCredentials([
                    string(credentialsId: 'NEXT_PUBLIC_SUPABASE_URL', variable: 'SUPABASE_URL'),
                    string(credentialsId: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', variable: 'SUPABASE_ANON_KEY'),
                    string(credentialsId: 'SUPABASE_SERVICE_ROLE_KEY', variable: 'SUPABASE_SERVICE_ROLE_KEY'),
                    string(credentialsId: 'GEMINI_API_KEY', variable: 'GEMINI_API_KEY')
                ]) {
                    sh '''
                    docker run -d \
                    --name ${BACKEND_CONTAINER} \
                    --network ${NETWORK_NAME} \
                    -p 3001:3001 \
                    -e SUPABASE_URL="$SUPABASE_URL" \
                    -e SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
                    -e SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
                    -e GEMINI_API_KEY="$GEMINI_API_KEY" \
                    ${BACKEND_IMAGE}:${IMAGE_TAG}
                    '''
                }
            }
        }

        stage('Run Frontend Container') {
            steps {
                sh '''
                docker run -d \
                --name ${FRONTEND_CONTAINER} \
                --network ${NETWORK_NAME} \
                -p 3000:3000 \
                ${FRONTEND_IMAGE}:${IMAGE_TAG}
                '''
            }
        }

        stage('Push Images') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {
                    sh '''
                    echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
        
                    docker tag ${FRONTEND_IMAGE}:${IMAGE_TAG} ${DOCKER_USER}/${FRONTEND_IMAGE}:${IMAGE_TAG}
                    docker tag ${FRONTEND_IMAGE}:${IMAGE_TAG} ${DOCKER_USER}/${FRONTEND_IMAGE}:latest
        
                    docker push ${DOCKER_USER}/${FRONTEND_IMAGE}:${IMAGE_TAG}
                    docker push ${DOCKER_USER}/${FRONTEND_IMAGE}:latest
        
                    docker tag ${BACKEND_IMAGE}:${IMAGE_TAG} ${DOCKER_USER}/${BACKEND_IMAGE}:${IMAGE_TAG}
                    docker tag ${BACKEND_IMAGE}:${IMAGE_TAG} ${DOCKER_USER}/${BACKEND_IMAGE}:latest
        
                    docker push ${DOCKER_USER}/${BACKEND_IMAGE}:${IMAGE_TAG}
                    docker push ${DOCKER_USER}/${BACKEND_IMAGE}:latest
                    '''
                }
            }
        }
}
    post {
    success {
        emailext(
    to: 'kd.codegeek@gmail.com',
    subject: "✅ Questly CI/CD | Build Success #${env.BUILD_NUMBER}",
    mimeType: 'text/html',
    body: """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>

<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px;">
<tr>
<td align="center">

<table width="700" cellpadding="0" cellspacing="0"
style="background:#ffffff;border-radius:14px;overflow:hidden;
box-shadow:0 10px 25px rgba(0,0,0,.12);">

<tr>
<td style="background:#111827;padding:28px;color:white;">
<h1 style="margin:0;">🚀 Questly CI/CD Pipeline</h1>
<p style="margin:8px 0 0;color:#d1d5db;">
Production Deployment Report
</p>
</td>
</tr>

<tr>
<td style="background:#16a34a;color:white;padding:18px;text-align:center;font-size:22px;font-weight:bold;">
✅ BUILD SUCCESSFUL
</td>
</tr>

<tr>
<td style="padding:30px;">

<h2 style="margin-top:0;color:#111827;">
Deployment Summary
</h2>

<table width="100%" cellpadding="12" cellspacing="0"
style="border-collapse:collapse;">

<tr style="background:#f8fafc;">
<td><b>Project</b></td>
<td>Questly</td>
</tr>

<tr>
<td><b>Job</b></td>
<td>${env.JOB_NAME}</td>
</tr>

<tr style="background:#f8fafc;">
<td><b>Build Number</b></td>
<td>#${env.BUILD_NUMBER}</td>
</tr>

<tr>
<td><b>Status</b></td>
<td style="color:#16a34a;font-weight:bold;">
SUCCESS
</td>
</tr>

<tr style="background:#f8fafc;">
<td><b>Build URL</b></td>
<td>
<a href="${env.BUILD_URL}">
Open Jenkins Build
</a>
</td>
</tr>

</table>

<br>

<table width="100%" cellpadding="14"
style="background:#ecfdf5;border-left:6px solid #16a34a;
border-radius:8px;">

<tr>
<td>

<b>Deployment Completed Successfully</b>

<ul style="margin-top:10px;">
<li>✅ Source code checked out</li>
<li>✅ Docker images built</li>
<li>✅ Backend container deployed</li>
<li>✅ Frontend container deployed</li>
<li>✅ Docker Hub images pushed</li>
</ul>

</td>
</tr>

</table>

<br>

<div style="text-align:center;">

<a href="${env.BUILD_URL}"
style="
background:#2563eb;
color:white;
padding:14px 28px;
border-radius:8px;
text-decoration:none;
font-weight:bold;">

View Build Details

</a>

</div>

</td>
</tr>

<tr>

<td style="background:#111827;color:#9ca3af;
padding:18px;text-align:center;">

Questly • Automated Jenkins CI/CD Pipeline

</td>

</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
"""
)

        echo 'Build Successful!'
    }

    failure {
        emailext(
    to: 'kd.codegeek@gmail.com',
    subject: "❌ Questly CI/CD | Build Failed #${env.BUILD_NUMBER}",
    mimeType: 'text/html',
    body: """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>

<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px;">
<tr>
<td align="center">

<table width="700" cellpadding="0" cellspacing="0"
style="background:#ffffff;border-radius:14px;overflow:hidden;
box-shadow:0 10px 25px rgba(0,0,0,.12);">

<tr>
<td style="background:#111827;padding:28px;color:white;">
<h1 style="margin:0;">🚀 Questly CI/CD Pipeline</h1>
<p style="margin:8px 0 0;color:#d1d5db;">
Production Deployment Report
</p>
</td>
</tr>

<tr>
<td style="background:#dc2626;color:white;padding:18px;text-align:center;font-size:22px;font-weight:bold;">
❌ BUILD FAILED
</td>
</tr>

<tr>
<td style="padding:30px;">

<h2 style="margin-top:0;color:#111827;">
Deployment Summary
</h2>

<table width="100%" cellpadding="12" cellspacing="0"
style="border-collapse:collapse;">

<tr style="background:#f8fafc;">
<td><b>Project</b></td>
<td>Questly</td>
</tr>

<tr>
<td><b>Job</b></td>
<td>${env.JOB_NAME}</td>
</tr>

<tr style="background:#f8fafc;">
<td><b>Build Number</b></td>
<td>#${env.BUILD_NUMBER}</td>
</tr>

<tr>
<td><b>Status</b></td>
<td style="color:#dc2626;font-weight:bold;">
FAILED
</td>
</tr>

<tr style="background:#f8fafc;">
<td><b>Build URL</b></td>
<td>
<a href="${env.BUILD_URL}">
Open Jenkins Build
</a>
</td>
</tr>

</table>

<br>

<table width="100%" cellpadding="14"
style="background:#fef2f2;border-left:6px solid #dc2626;
border-radius:8px;">

<tr>
<td>

<b>Deployment Failed</b>

<ul style="margin-top:10px;">
<li>❌ Pipeline execution terminated</li>
<li>❌ Deployment was not completed</li>
<li>❌ One or more stages encountered an error</li>
<li>❌ Review Jenkins console logs for the root cause</li>
</ul>

</td>
</tr>

</table>

<br>

<div style="text-align:center;">

<a href="${env.BUILD_URL}"
style="
background:#dc2626;
color:white;
padding:14px 28px;
border-radius:8px;
text-decoration:none;
font-weight:bold;">

View Error Logs

</a>

</div>

</td>
</tr>

<tr>

<td style="background:#111827;color:#9ca3af;
padding:18px;text-align:center;">

Questly • Automated Jenkins CI/CD Pipeline

</td>

</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
"""
)

        echo 'Pipeline Failed!'
    }

    always {
        sh 'docker logout || true'
    }
}
    
}