<div align="center">

# 🚀 Questly Frontend

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/AWS-EC2-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js&logoColor=white" />
</p>

### 🌐 Frontend of the **Questly 3-Tier Architecture**

**Build • Run • Deploy using Docker on AWS EC2**

</div>

---

# 📖 Overview

Welcome to the **Questly Frontend**.

This folder contains the complete **Next.js frontend application** for the Questly 3-Tier Architecture project.

Follow the guide below to create the required environment variables, build the Docker image, run the container, and access the application on your AWS EC2 instance.

---

# 📂 Project Structure

```text
frontend/
│
├── 📁 app/
├── 📁 components/
├── 📁 docs/
│   └── 📄 Dockerfile_multistage.md
├── 📁 lib/
├── 📁 public/
│
├── 📄 .dockerignore
├── 📄 .gitignore
├── 🐳 Dockerfile
├── 🐳 Dockerfile.multistage
├── 📄 package.json
├── 📄 package-lock.json
├── 📄 next.config.ts
├── 📄 middleware.ts
├── 📄 eslint.config.mjs
├── 📄 postcss.config.mjs
├── 📄 tailwind.config.ts
├── 📄 tsconfig.json
└── 📖 README.md
```

---

# ✅ Prerequisites

Before proceeding, ensure you have:

- 🐳 Docker installed
- ☁️ An AWS EC2 instance running
- 💻 Git installed
- 📥 This repository cloned to your machine
- 🔑 Your own Supabase and Google Gemini API credentials

---

# 🚀 Step 1: Navigate to the Frontend Directory

Open your terminal and move into the frontend folder.

```bash
cd frontend
```

---

# 📝 Step 2: Create the `.env` File

Inside the **frontend** directory, create a new file named:

```text
.env
```

Paste the following template into the file.

```env
# ==========================
# Supabase Configuration
# ==========================

NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# ==========================
# Google Gemini API
# ==========================

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

> ⚠️ **Important**
>
> - Replace every placeholder value with your own credentials.
> - Never commit your real `.env` file to GitHub.
> - Keep your API keys private.

---

# ⚠️ Step 3: Update the `.dockerignore` File

Before building the Docker image, open the `.dockerignore` file.

Locate the following line:

```text
.env
```

Remove it or comment it out.

### Before

```text
.env
```

### After

```text
# .env
```

or simply delete the line.

> 💡 Docker needs access to the `.env` file while building the production image.

---

# 🐳 Step 4: Build the Docker Image

Run the following command inside the **frontend** directory.

```bash
docker build -t frontimg -f Dockerfile.multistage .
```

### 📌 What this command does

- 📦 Builds the Docker image

- 🏷️ Creates an image named **frontimg**

- 📄 Uses the **Dockerfile.multistage**

- ⚡ Produces a lightweight production-ready image

---

# ▶️ Step 5: Run the Docker Container

After the image is built successfully, start the container.

```bash
docker run -d -p 3000:3000 --name frontcont frontimg
```

### What this command does

- 🚀 Creates a container named **frontcont**

- 🌐 Maps port **3000** of your EC2 instance to the container

- 🔄 Runs the application in detached mode

---

# ☁️ Step 6: Open Port **3000** in AWS EC2

Go to your AWS Console.

Navigate to:

```text
EC2
   └── Instances
         └── Select Your Instance
                └── Security
                      └── Security Groups
                             └── Inbound Rules
                                    └── Edit Inbound Rules
```

Add the following inbound rule.

| Type | Protocol | Port Range | Source |
|------|----------|-----------|--------|
| Custom TCP | TCP | 3000 | Anywhere (0.0.0.0/0) |

Click **Save Rules**.

> ⚠️ If port **3000** is blocked, your application will not be accessible from outside the EC2 instance.

---

# 🌍 Step 7: Access the Application

Copy the **Public IPv4 Address** of your EC2 instance.

Open your favorite browser and visit:

```text
http://<YOUR_PUBLIC_IP>:3000
```

Example

```text
http://13.201.25.100:3000
```

🎉 Congratulations! Your Questly Frontend is now running successfully.

---

# Useful Docker Commands

## View Running Containers

```bash
docker ps
```

---

## View All Containers

```bash
docker ps -a
```

---

## View Docker Images

```bash
docker images
```

---

## Stop the Container

```bash
docker stop frontcont
```

---

## Start the Container Again

```bash
docker start frontcont
```

---

## Restart the Container

```bash
docker restart frontcont
```

---

## Remove the Container

```bash
docker rm -f frontcont
```

---

## Remove the Docker Image

```bash
docker rmi frontimg
```

---

# Troubleshooting

### 🚫 Unable to Access the Website?

✔️ Verify the Docker container is running.

```bash
docker ps
```

---

✔️ Ensure the `.env` file exists inside the **frontend** folder.

---

✔️ Make sure `.env` is **not** ignored inside `.dockerignore`.

---

✔️ Confirm the Docker image was built successfully.

```bash
docker images
```

---

✔️ Verify that port **3000** is allowed in your EC2 Security Group.

---

✔️ Ensure you're using the correct **Public IPv4 Address**.

---

✔️ Confirm Docker is running on your EC2 instance.

---

# 🎯 You're All Set!

If you've followed every step above, your **Questly Frontend** should now be running successfully on your AWS EC2 instance.

Happy Coding! 🚀