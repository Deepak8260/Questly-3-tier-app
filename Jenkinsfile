// =====================================================================
// Questly - CD pipeline (kind)
//
// Jenkins Credentials Manager : CI credentials (GitHub token, ...)
// Kubernetes Secrets          : application credentials
//                               (questly-backend-secrets / questly-frontend-secrets)
//
// Images are already on Docker Hub (kumar3472/questly-*:latest).
// All deployment logic lives in k8s/deploy.sh.
// =====================================================================

pipeline {

    agent {
        label 'flask-builder'
    }

    parameters {
        string(name: 'BRANCH', defaultValue: 'main', description: 'Git branch to deploy')
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {

        stage('Checkout Source Code') {
            steps {
                git branch: "${params.BRANCH}",
                    url: 'https://github.com/Deepak8260/Questly-3-tier-app.git',
                    credentialsId: 'github-token'
            }
        }

        stage('Deploy to kind') {
            steps {
                sh 'bash k8s/deploy.sh'
            }
        }
    }

    // =================================================================
    post {

        success {
            emailext(
                to: 'kd.codegeek@gmail.com',
                subject: "✅ Questly CI/CD | Build Success #${env.BUILD_NUMBER}",
                mimeType: 'text/html',
                body: """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px;"><tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.12);">

<tr><td style="background:#111827;padding:28px;color:white;">
<h1 style="margin:0;">🚀 Questly CI/CD Pipeline</h1>
<p style="margin:8px 0 0;color:#d1d5db;">Deployment Report</p>
</td></tr>

<tr><td style="background:#16a34a;color:white;padding:18px;text-align:center;font-size:22px;font-weight:bold;">
✅ BUILD SUCCESSFUL
</td></tr>

<tr><td style="padding:30px;">
<h2 style="margin-top:0;color:#111827;">Deployment Summary</h2>
<table width="100%" cellpadding="12" cellspacing="0" style="border-collapse:collapse;">
<tr style="background:#f8fafc;"><td><b>Project</b></td><td>Questly</td></tr>
<tr><td><b>Job</b></td><td>${env.JOB_NAME}</td></tr>
<tr style="background:#f8fafc;"><td><b>Build Number</b></td><td>#${env.BUILD_NUMBER}</td></tr>
<tr><td><b>Branch</b></td><td>${params.BRANCH}</td></tr>
<tr style="background:#f8fafc;"><td><b>Deploy Target</b></td><td>kind (namespace questly-ns)</td></tr>
<tr><td><b>Backend Image</b></td><td>kumar3472/questly-backend:latest</td></tr>
<tr style="background:#f8fafc;"><td><b>Frontend Image</b></td><td>kumar3472/questly-frontend:latest</td></tr>
<tr><td><b>Status</b></td><td style="color:#16a34a;font-weight:bold;">SUCCESS</td></tr>
</table>
<br>
<table width="100%" cellpadding="14" style="background:#ecfdf5;border-left:6px solid #16a34a;border-radius:8px;"><tr><td>
<b>Deployment Completed</b>
<ul style="margin-top:10px;">
<li>✅ Source code checked out</li>
<li>✅ k8s/deploy.sh completed (cluster, namespace, secrets, manifests)</li>
</ul>
</td></tr></table>
<br>
<div style="text-align:center;">
<a href="${env.BUILD_URL}" style="background:#2563eb;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">View Build Details</a>
</div>
</td></tr>

<tr><td style="background:#111827;color:#9ca3af;padding:18px;text-align:center;">
Questly • Automated Jenkins CI/CD Pipeline
</td></tr>

</table>
</td></tr></table>
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
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px;"><tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.12);">

<tr><td style="background:#111827;padding:28px;color:white;">
<h1 style="margin:0;">🚀 Questly CI/CD Pipeline</h1>
<p style="margin:8px 0 0;color:#d1d5db;">Deployment Report</p>
</td></tr>

<tr><td style="background:#dc2626;color:white;padding:18px;text-align:center;font-size:22px;font-weight:bold;">
❌ BUILD FAILED
</td></tr>

<tr><td style="padding:30px;">
<h2 style="margin-top:0;color:#111827;">Build Summary</h2>
<table width="100%" cellpadding="12" cellspacing="0" style="border-collapse:collapse;">
<tr style="background:#f8fafc;"><td><b>Project</b></td><td>Questly</td></tr>
<tr><td><b>Job</b></td><td>${env.JOB_NAME}</td></tr>
<tr style="background:#f8fafc;"><td><b>Build Number</b></td><td>#${env.BUILD_NUMBER}</td></tr>
<tr><td><b>Branch</b></td><td>${params.BRANCH}</td></tr>
<tr style="background:#f8fafc;"><td><b>Deploy Target</b></td><td>kind (namespace questly-ns)</td></tr>
<tr><td><b>Status</b></td><td style="color:#dc2626;font-weight:bold;">FAILED</td></tr>
</table>
<br>
<table width="100%" cellpadding="14" style="background:#fef2f2;border-left:6px solid #dc2626;border-radius:8px;"><tr><td>
<b>Pipeline Failed</b>
<ul style="margin-top:10px;">
<li>❌ One or more stages encountered an error</li>
<li>❌ Deployment to kind did not complete</li>
<li>❌ Review the Jenkins console log for the root cause</li>
</ul>
</td></tr></table>
<br>
<div style="text-align:center;">
<a href="${env.BUILD_URL}console" style="background:#dc2626;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">View Error Logs</a>
</div>
</td></tr>

<tr><td style="background:#111827;color:#9ca3af;padding:18px;text-align:center;">
Questly • Automated Jenkins CI/CD Pipeline
</td></tr>

</table>
</td></tr></table>
</body>
</html>
"""
            )
            echo 'Pipeline Failed!'
        }

        always {
            sh 'kubectl -n questly-ns get pods || true'
        }
    }
}
