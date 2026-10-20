# Jenkins 2: Credentials and Email Notifications

Store the GitHub token in Jenkins and set up Gmail, so the pipeline can
check out the repo and email you the result of every build.

| | |
|---|---|
| **Before this guide** | [01-connect-master-and-agent.md](01-connect-master-and-agent.md): the agent `questly-agent` is online. |
| **After this guide** | [03-agent-workspace-and-env-files.md](03-agent-workspace-and-env-files.md) |
| **Time** | About 15 minutes |

## Contents

1. [Which credentials this project needs](#which-credentials-this-project-needs)
2. [Step 1: Create a GitHub personal access token](#step-1-create-a-github-personal-access-token)
3. [Step 2: Add the GitHub credential in Jenkins](#step-2-add-the-github-credential-in-jenkins)
4. [Step 3: Create a Gmail App Password](#step-3-create-a-gmail-app-password)
5. [Step 4: Add the Gmail credential in Jenkins](#step-4-add-the-gmail-credential-in-jenkins)
6. [Step 5: Configure Extended E-mail Notification](#step-5-configure-extended-e-mail-notification)
7. [Step 6: Set the sender address](#step-6-set-the-sender-address)
8. [Step 7: Check who receives the email](#step-7-check-who-receives-the-email)
9. [Checklist](#checklist)
10. [Troubleshooting](#troubleshooting)

---

## Which credentials this project needs

Jenkins keeps passwords and keys in its **Credentials** store. The
`Jenkinsfile` refers to them by **ID**, so each ID must be typed exactly.

| ID | Kind | Used by | Created in |
|---|---|---|---|
| `agent-ssh-key` | SSH Username with private key | The `questly-agent` node | [Guide 1](01-connect-master-and-agent.md), step 6 |
| `github-token` | Username with password | The `Jenkinsfile` checkout: `credentialsId: 'github-token'` | Step 2 below |
| `gmail-smtp` | Username with password | The email settings in step 5 | Step 4 below |

**No Docker Hub credential is needed.** This pipeline does not build or
push images. It deploys the images already on Docker Hub
(`kumar3472/questly-frontend:latest` and `kumar3472/questly-backend:latest`),
which are public, so pulling them needs no login. You push new images
from your laptop; see the [Docker guides](../README.md#1-docker).

**The app's own secrets are not stored in Jenkins either.** The Supabase
and Gemini keys live in the `.env` files on the agent, which become
Kubernetes secrets. That is [guide 3](03-agent-workspace-and-env-files.md).

All credentials below are added at:

**Manage Jenkins → Credentials → System → Global credentials
(unrestricted) → Add Credentials**

---

## Step 1: Create a GitHub personal access token

**Where:** GitHub, in the browser.

A token is a password made for one purpose that you can delete at any
time. Jenkins uses it instead of your GitHub password.

1. GitHub → your picture (top right) → **Settings**.
2. **Developer settings** (bottom of the left menu) → **Personal access
   tokens → Tokens (classic)** → **Generate new token (classic)**.
3. **Note:** `jenkins-questly`. **Expiration:** your choice.
4. Tick the **`repo`** scope.
5. Click **Generate token** and copy it straight away. GitHub never
   shows it again.

## Step 2: Add the GitHub credential in Jenkins

**Where:** Jenkins → Global credentials → Add Credentials.

| Field | Value |
|---|---|
| Kind | Username with password |
| Scope | Global |
| Username | `Deepak8260` |
| Password | the token from step 1 |
| ID | `github-token` |
| Description | `GitHub token for the Questly repository` |

Click **Create**.

The ID must be exactly `github-token`. The `Jenkinsfile` uses it in the
checkout stage, and the pipeline job uses it in [guide 4](04-pipeline-job-and-webhook.md).

## Step 3: Create a Gmail App Password

**Where:** your Google account, in the browser.

Gmail does not let other programs log in with your normal password. It
needs an **App Password**: a 16-character password for one program.

1. Open <https://myaccount.google.com> → **Security**.
2. Under **How you sign in to Google**, turn **2-Step Verification**
   **on**. App Passwords do not exist without it.
3. Open <https://myaccount.google.com/apppasswords>, or search for
   **App passwords** in the Security page.
4. Name it `jenkins-questly` and click **Create**.
5. Copy the 16-character password. It is shown only once.

## Step 4: Add the Gmail credential in Jenkins

**Where:** Jenkins → Global credentials → Add Credentials.

| Field | Value |
|---|---|
| Kind | Username with password |
| Scope | Global |
| Username | your Gmail address, such as `yourname@gmail.com` |
| Password | the App Password from step 3, without spaces |
| ID | `gmail-smtp` |
| Description | `Gmail App Password for build notifications` |

Click **Create**.

## Step 5: Configure Extended E-mail Notification

**Where:** Jenkins → **Manage Jenkins → System**. Scroll to the
**Extended E-mail Notification** section.

Fill in **only these four fields**:

| Field | Value |
|---|---|
| SMTP server | `smtp.gmail.com` |
| SMTP Port | `465` |
| Credentials | `gmail-smtp` (click **Advanced** if the field is hidden) |
| Use SSL | ticked |

**Leave every other field in this section empty**, especially **Default
Recipients**, **Reply To List**, **Default Subject** and **Default
Content**. The `Jenkinsfile` sets its own recipient, subject and HTML
body. Values typed here can override them and break the emails.

Do not click **Save** yet.

## Step 6: Set the sender address

**Where:** the same **Manage Jenkins → System** page, section **Jenkins
Location**.

| Field | Value |
|---|---|
| Jenkins URL | `http://<master-ip>:8080/` (already filled in by the setup wizard) |
| System Admin e-mail address | the same Gmail address as in step 4 |

Gmail only sends mail whose "From" address is the account that logs in,
so this must match the credential.

Now click **Save** at the bottom of the page.

## Step 7: Check who receives the email

**Where:** the `Jenkinsfile` in the repo.

The address is written in the `Jenkinsfile`, in both the `success` and
`failure` blocks:

```groovy
emailext(
    to: 'kd.codegeek@gmail.com',
    ...
)
```

To receive the mails somewhere else, change both `to:` lines, commit and
push. This is the address that **receives** the mail; it does not have
to be the Gmail account that **sends** it.

---

## Checklist

| Check | Where |
|---|---|
| `github-token`, `gmail-smtp` and `agent-ssh-key` exist | Manage Jenkins → Credentials → Global |
| Only the four SMTP fields are filled in | Manage Jenkins → System → Extended E-mail Notification |
| System Admin e-mail address is the sending Gmail address | Manage Jenkins → System → Jenkins Location |
| The `to:` address in the `Jenkinsfile` is where you want the mails | `Jenkinsfile`, `success` and `failure` blocks |

You will see the first email after the first build in [guide 4](04-pipeline-job-and-webhook.md).

**Next:** [03-agent-workspace-and-env-files.md](03-agent-workspace-and-env-files.md)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `CredentialId "github-token" could not be found` | The ID is misspelled. | Edit the credential; the ID must be exactly `github-token`. |
| Checkout fails with `Authentication failed` | The token expired or lacks the `repo` scope. | Create a new token (step 1) and update the credential's password. |
| No **App passwords** page in Google | 2-Step Verification is off. | Turn it on first (step 3). |
| Console: `535 Username and Password not accepted` | The normal Gmail password was used, or the App Password has spaces. | Use the App Password, without spaces. |
| No email arrives, no error in the console | A Default Recipients or Default Subject value is set. | Clear every field in Extended E-mail Notification except the four in step 5. |
| Email arrives in Spam | Gmail is unsure of the sender. | Mark it **Not spam** once. |
| Console: `No such DSL method 'emailext'` | The Email Extension plugin is missing. | Install it ([guide 1](01-connect-master-and-agent.md), step 2). |
