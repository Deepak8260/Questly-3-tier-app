# Docker Image Optimization for Next.js Applications (Explained Like You're Learning It for the First Time)

## Why This Topic Matters

When you package a web application inside Docker, the size of the final image matters a lot. A smaller image downloads faster, starts faster, uses less disk space on servers, and has fewer things inside it that a hacker could misuse. In this topic, we look at a real example where a Next.js application's Docker image was reduced from about **1.7 GB** all the way down to about **311 MB**, just by changing how the Dockerfile was written and how the project was configured. This is a very common real-world optimization, and it also shows up a lot in technical interviews.

## A Few Basic Words You Need to Know Before We Start

Before touching any code, let's get comfortable with a few words that will be used again and again. Think of this like learning the names of your kitchen tools before you start cooking.

**Image** — An image is like a frozen, ready-made recipe box. It contains everything needed to run a program: the code, the tools, and the settings. It doesn't do anything by itself; it just sits there, ready to be used.

**Container** — A container is what you get when you actually "open up" an image and run it. If the image is the recipe box, the container is the actual meal being cooked and served, using that recipe box.

**Dockerfile** — This is a plain text file containing step-by-step instructions that tell Docker exactly how to build an image. It's like a written recipe: "first do this, then do that."

**Stage** — A Dockerfile can be broken into more than one section, and each section is called a stage. Think of it like having two separate kitchens: one kitchen where you do all the messy cooking and preparation (this is called the builder stage), and a second, clean kitchen where you only place the final, finished dish on a plate for serving (this is called the runner stage). Nothing automatically moves from kitchen one to kitchen two; you must carry over only the exact dishes you want.

**Layer** — Every single instruction in a Dockerfile (like copying a file or installing something) creates a new "layer" inside the image, kind of like adding one more sheet of paper to a stack. Docker is smart enough to remember old layers and reuse them if nothing has changed, which is why we will later see the order of instructions in a Dockerfile matters a lot.

Now that we know these basic words, let's look at the actual files.

---

# The Old Dockerfile (Before Optimization)

Here is the complete file exactly as it was written, before any changes:

```dockerfile
# Builder Stage
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Runner Stage
FROM node:22-slim AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./

RUN npm ci --only=production

EXPOSE 3000

CMD ["npm", "start"]
```

When this file is used to build an image, the final image size comes out to roughly **1.6 GB to 1.7 GB**. That is a really big image for what is supposed to be a simple web application, and we are about to understand exactly why, line by line.

## Explaining the Old Dockerfile, Line by Line, Word by Word

### `# Builder Stage`

Any line that starts with a `#` symbol in a Dockerfile is just a comment. Docker completely ignores it. It's only there so a human reading the file can understand what's happening. It has zero effect on the final image.

### `FROM node:22-slim AS builder`

Let's break this single line into pieces, because every word here matters.

- `FROM` is a Dockerfile instruction that means "start building on top of this existing image." Every Dockerfile must begin with a `FROM` line, because Docker cannot build an image out of absolutely nothing; it always needs a starting point.
- `node:22-slim` tells Docker exactly which starting image to download and use. The part before the colon, `node`, is the name of the image (an official image maintained by the Node.js team that already has Node.js installed on top of a small Linux system). The part after the colon, `22-slim`, is called a "tag," and it tells Docker which specific version to grab. Here, `22` means Node.js version 22, and `slim` means it's a smaller, trimmed-down version of the usual Node image (it still has the basics like a shell and some Linux tools, but fewer extras than the biggest, fattest version of the Node image).
- `AS builder` gives this stage a nickname: "builder." Imagine you're labeling one of your two kitchens with a sticky note that says "Builder Kitchen," so that later on, you can simply say "grab that dish from the Builder Kitchen" instead of describing its exact location all over again.

So, in plain words, this whole line says: "Start a new image, based on Node.js version 22's slim version, and let's call this stage 'builder' so we can refer to it later."

### `WORKDIR /app`

- `WORKDIR` stands for "working directory." It's like saying "from now on, every following command should happen inside this specific folder."
- `/app` is simply the name and location of that folder. Docker will create this folder automatically if it doesn't already exist.

Without this line, Docker commands would run from the very top-level root folder of the container, which would make the whole project messy and disorganized, kind of like dumping all your groceries loose on the kitchen floor instead of putting them on the counter.

### `COPY package*.json ./`

- `COPY` is an instruction that copies files or folders from your computer (outside the container) into the image (inside the container).
- `package*.json` uses a wildcard symbol, the asterisk (`*`). A wildcard means "match anything here." So `package*.json` matches any file that starts with the word "package" and ends with ".json" — in a typical Node.js project, this grabs exactly two files: `package.json` and `package-lock.json`. Think of the asterisk like a blank tile in a word game that can stand in for any missing letters.
- `./` means "put it right here," referring to the current working directory we set up earlier, which is `/app`.

Notice something important: at this point, Docker copies **only** these two small files, not your entire project yet. This is done on purpose, and here's why, explained with a simple example. Imagine tomorrow, you change just one tiny word inside one of your React components, but you don't add or remove any dependency, so your `package.json` file stays exactly the same. Because Docker remembers ("caches") the result of installing dependencies from last time, and because this particular file hasn't changed, Docker will skip reinstalling everything from scratch and instantly reuse the old result. This can save several minutes on every single build. If we had copied the entire project all at once instead, even a tiny one-word code change would force Docker to reinstall every single dependency all over again, since Docker would think "something changed here," even though the real change had nothing to do with dependencies.

### `RUN npm install`

- `RUN` is an instruction that tells Docker "actually execute this command inside the container, right now, while building the image." Whatever this command produces or changes becomes a permanent part of the image.
- `npm` stands for "Node Package Manager." It is a tool that comes bundled with Node.js, and its whole job is to download and manage the external code libraries (called "packages" or "dependencies") that your project needs to work, such as React, Next.js, Tailwind CSS, and so on.
- `install` is the specific action being requested from npm. When you say `npm install`, you're telling npm: "look inside my `package.json` file, see which packages are listed there, and download every one of them."

After this line runs, a new folder called `node_modules` appears inside the container, filled with all of your project's downloaded dependencies.

### `COPY . .`

- Here, `COPY` is used again, but this time both the source and the destination use a single dot (`.`), which means "current folder." The first dot refers to the current folder on your computer (your whole project folder), and the second dot refers to the current working folder inside the container (which we already set to `/app`).

In plain words, this line means: "Now copy absolutely everything else from my project — all my source code files, my components, my configuration files, my public assets, everything — into the container." This step is deliberately done *after* installing dependencies, again purely to take advantage of Docker's caching trick explained above.

### `RUN npm run build`

- `RUN` again means "actually execute this command while building the image."
- `npm run` is how you tell npm "please execute one of the custom scripts listed inside my `package.json` file's scripts section," rather than one of npm's built-in commands.
- `build` is the specific name of the script being run. In a typical Next.js project, the "build" script internally runs the command `next build`, which compiles, optimizes, and prepares your entire application to run smoothly in production (rather than the slower, more relaxed mode used during development).

After this step finishes, a brand-new folder called `.next` appears inside the container. This folder holds everything Next.js generated during the build process — but, as we'll see very soon, it holds a lot more than what's actually necessary to just run the finished app.

At this exact point, the "builder" kitchen now contains your full original source code, a complete `node_modules` folder, the entire `.next` build output, and your `package.json` file. That's a lot of stuff — far more than what you'd actually need to just serve the finished website to users.

### `# Runner Stage`

Just another comment for human readers, ignored by Docker.

### `FROM node:22-slim AS runner`

This is one of the most important lines to truly understand. It looks similar to the very first line of the file, but it behaves very differently here, because we are no longer inside the builder stage.

This line says: "Start a **completely brand-new, empty image**, again based on Node.js 22 slim, and call this new stage 'runner.'"

Here is the key idea that trips up a lot of beginners: this new "runner" image does **not** automatically contain anything from the "builder" stage. It's like walking into a totally different, empty kitchen. If you want something from the first kitchen (the builder stage), you have to deliberately carry it over yourself, one item at a time, which is exactly what the next few lines do.

### `WORKDIR /app`

Exactly the same meaning as before: create and switch into an `/app` folder, but this time inside the brand-new runner image.

### `COPY --from=builder /app/package*.json ./`

- `COPY` again means "bring files into this image."
- `--from=builder` is a special flag (an extra option you attach to a command using two dashes) that tells Docker "don't copy this from my own computer — instead, copy it from that other stage I labeled 'builder' earlier." This is the exact reason we gave that stage a nickname before.
- `/app/package*.json` is the location, inside the builder stage, of the files being grabbed (again, matching `package.json` and `package-lock.json` using the same wildcard trick as before).
- `./` again means "place it right here," in the runner's own `/app` folder.

### `COPY --from=builder /app/.next ./.next`

This line copies the **entire** `.next` folder from the builder stage into the runner stage. This single line turns out to be one of the biggest reasons this image ends up so large, because as mentioned earlier, the `.next` folder contains a lot of extra material that isn't strictly needed just to run the finished application — things like internal build caches, trace files that help debug the build process, and various manifests (organizational files that list what was built). All of this gets copied over, even though most of it will never actually be used once the app is running.

### `COPY --from=builder /app/public ./public`

This copies the `public` folder, which typically holds static files meant to be served directly to users, such as images, icons, and fonts.

### `COPY --from=builder /app/next.config.* ./`

This copies the Next.js configuration file (something like `next.config.js` or `next.config.ts`), again using the asterisk wildcard so it matches whichever specific file extension your project happens to use.

### `RUN npm ci --only=production`

This line deserves a very careful explanation, because it's one of the biggest culprits behind the large image size.

- `RUN` — execute this command while building the image, just like before.
- `npm ci` — this is a specific npm command, different from `npm install`. The letters "ci" stand for "continuous integration." Unlike `npm install`, which can sometimes slightly adjust package versions to keep things compatible, `npm ci` strictly installs the **exact** versions listed in your lock file, no adjustments allowed. This makes it more predictable and reliable, which is especially valuable in automated build pipelines.
- `--only=production` is a flag (an extra option) that tells npm "only install the dependencies that are actually needed to run the app in production, and skip the ones that are only useful during development," such as testing tools or code formatters.

Here is the real problem with this line, though: dependencies were **already installed once**, back in the builder stage, using `npm install`. Now, this line installs dependencies **all over again**, from scratch, in the runner stage. Even though development-only dependencies are being skipped this time, the production dependencies alone for a typical Next.js project can still be quite large, easily hundreds of megabytes. Installing them a second time adds a huge amount of unnecessary size to the final image, for something that had technically already been done once before.

### `EXPOSE 3000`

- `EXPOSE` is an instruction that documents which network port the application inside the container will be listening on. Port 3000 is simply a commonly used default port for Node.js web applications.

It's worth understanding clearly that this line by itself does not actually open up or "publish" that port to the outside world. It's more like a label or a note attached to the image saying "hey, if you want to talk to me, use port 3000." The port only actually becomes reachable later, when someone runs the container using a command that explicitly maps the port, such as `docker run -p 3000:3000`.

### `CMD ["npm", "start"]`

- `CMD` is an instruction that defines the default command that should run automatically whenever a container is started from this image. Unlike `RUN`, which executes something once while the image is being *built*, `CMD` only defines what should happen later, when the image is actually *run* as a container.
- The square brackets with comma-separated items in quotes, like `["npm", "start"]`, are what's called the "exec form" of writing a command in Docker. Instead of writing it as one long sentence like `npm start`, Docker prefers you break it into separate pieces: the program to run (`npm`) and its argument (`start`). This form runs slightly more efficiently and predictably than the plain sentence form.

So when a container starts from this image, Docker essentially runs `npm start`. As we explained a moment ago, npm will look inside `package.json`, find the script named "start" (which normally points to `next start`), and that will finally boot up the Next.js production web server.

## Why the Old Image Stays So Large

Once you put it all together, the final runner image ends up containing an entire small Linux operating system, the full Node.js runtime, npm itself, a shell program (bash), other small Linux utilities, the entire `.next` folder (packed with extra material it doesn't strictly need), and a full, freshly reinstalled set of production `node_modules`. Every single one of these pieces adds weight, which is exactly why the final image size lands around 1.6 to 1.7 GB.

---

# Step Zero of the Optimization: A Small But Very Important Config Change

Before we can even look at the new, optimized Dockerfile, there's one small change that has to happen first, and it doesn't happen inside the Dockerfile at all — it happens inside your project's own Next.js configuration file (usually called `next.config.js` or `next.config.ts`).

You need to add one setting to that file:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

module.exports = nextConfig;
```

## What Does This Line Actually Do, In Very Simple Words?

Let's use a simple, everyday example to understand this. Imagine you're a chef, and normally, whenever you cook a big meal, you leave every single ingredient, tool, spice jar, and leftover scrap sitting all over the kitchen counter after you're done, even the stuff you didn't actually end up using in the final dish. If someone else wanted to come and just serve that meal to a customer, they'd have to dig through this entire messy counter to find the parts that actually matter.

Setting `output: "standalone"` is like telling that chef: "Once you're done cooking, please gather up **only** the exact ingredients and tools that are actually part of the final dish, and place them neatly into one small, ready-to-go takeaway box, so that anyone can pick up that box and immediately serve the meal without needing anything else from the messy kitchen."

In technical terms, this setting tells Next.js: "When you finish building my app, don't just leave everything scattered inside the regular `.next` folder. Instead, also create a special, extra folder called `standalone`, and inside it, place only the exact minimum set of files needed to actually run this application — including a ready-made small server program, and only the specific dependency files that are truly required, nothing extra."

## Why Do We Need to Do This Manually?

By default, Next.js does not do this automatically, because not every project deploys the same way; some projects need the full, regular `.next` folder for certain hosting setups. So Next.js leaves this as an optional setting that you, the developer, have to turn on yourself, specifically when you know you're going to be deploying using something lightweight, like a minimal Docker image.

## What Happens After You Turn It On?

Once this setting is added and you run the normal build command again, Next.js produces a folder structure that looks like this:

```
.next
  standalone/
  static/
```

The `standalone` folder is the "takeaway box" from our chef example. It holds a small, ready-to-run server file, plus only the small set of dependencies that are truly needed, and nothing more. This one small configuration change is what makes the rest of the optimized Dockerfile possible, so it's genuinely the very first and most important step of this whole process.

---

# The New, Optimized Dockerfile (After Optimization)

Now that the `standalone` setting is turned on in the project, here is the complete new Dockerfile, in full:

```dockerfile
# -----------------------------
# Builder Stage
# -----------------------------
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build


# -----------------------------
# Runner Stage
# -----------------------------
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["server.js"]
```

When this file is used to build an image (together with the `output: "standalone"` setting we just added), the final image size comes out to roughly **311 MB** — over five times smaller than before. Let's now go through every single line of this new file too, so nothing at all is left unclear.

## Explaining the New Dockerfile, Line by Line, Word by Word

### `# Builder Stage`

Just a comment again, ignored by Docker, purely there to help a human reader.

### `FROM node:22-slim AS builder`

This is exactly the same as before: start from the Node.js 22 slim image, and nickname this stage "builder." The builder stage still needs a somewhat full-featured environment, because it needs to actually run the build tools, so it still uses the regular slim Node image, not the lightweight one we'll use later.

### `WORKDIR /app`

Same meaning as before: set up and switch into an `/app` folder for all following commands.

### `COPY package*.json ./`

Same meaning as before: copy only `package.json` and `package-lock.json` first, so Docker can cleverly reuse cached dependency installations on future builds if these files haven't changed.

### `RUN npm ci`

Here, `npm ci` is used instead of `npm install`, for the same reliability reason explained earlier: it installs exactly the versions listed in the lock file, ensuring the build is predictable and repeatable every single time. Notice that this time, there's no `--only=production` flag attached. That's intentional and important: at this stage, we still need the development dependencies too, because some of them are required by the build tools themselves in order to actually compile and build the project properly. We'll make sure to leave out anything unnecessary later, in the runner stage, rather than here.

### `COPY . .`

Same meaning as before: now copy the rest of your entire project into the container, after dependencies have already been installed.

### `RUN npm run build`

Same meaning as before: run the build script, which internally triggers `next build`. But now, because we turned on `output: "standalone"` in the config file earlier, this build step produces that extra special `standalone` folder we discussed above, in addition to the regular build output.

At the end of this builder stage, just like before, this kitchen contains a lot of extra stuff. But this time, buried inside all of that, there's also a small, neatly packed "takeaway box" (the `standalone` folder) containing just what's needed to run the app. That box is the only thing we're going to bother carrying over into the next stage.

### `FROM gcr.io/distroless/nodejs22-debian12`

This is the single biggest change compared to the old Dockerfile, so let's slow down and unpack it carefully, piece by piece.

First, let's define a brand-new word we haven't used yet: **distroless**. A regular Docker base image, like `node:22-slim`, is built on top of a mini version of a full Linux operating system ("distro" is short for "distribution," referring to a full package of an operating system like Debian or Ubuntu). A "distroless" image, on the other hand, deliberately leaves out that entire general-purpose operating system layer. Instead, it includes only the bare minimum required to run one specific type of program — in this case, Node.js applications — and nothing else. Imagine the difference between renting a fully furnished house with a kitchen, gym, and garage you'll never use, versus renting a small room that has exactly one thing: a bed to sleep in, because sleeping is the only thing you actually need to do there.

Now let's break down the actual text `gcr.io/distroless/nodejs22-debian12` piece by piece:

- `gcr.io` stands for "Google Container Registry." A "registry" is simply an online storage location where Docker images are kept, similar to how an app store hosts apps you can download. This particular part of the address tells Docker "go fetch this image from Google's registry," rather than the default Docker Hub registry used earlier for the plain `node` image.
- `distroless` is the name of the specific collection or "team" of images being used here, referring to Google's distroless image project.
- `nodejs22-debian12` is the specific image name and version being requested: a distroless image that supports Node.js version 22, built using Debian 12 as its extremely minimal underlying base.

Unlike `node:22-slim`, this distroless image does **not** include a shell (no bash, no sh), does **not** include npm or any other package manager, and does **not** include general Linux command-line utilities. It includes only the Node.js runtime itself, plus the small set of shared system libraries that Node.js needs in order to actually function. This makes the image both dramatically smaller and noticeably more secure, since there's simply much less software present that could ever be misused.

### `WORKDIR /app`

Same meaning as always: create and use an `/app` folder as the working location, now inside this new distroless image.

### `COPY --from=builder /app/.next/standalone ./`

This is the heart of the entire optimization. Instead of copying the whole `.next` folder like the old Dockerfile did, this line reaches into the builder stage and grabs **only** the `standalone` folder — that neatly packed "takeaway box" we talked about earlier — and places its contents directly into the runner's `/app` folder. This one folder already contains a ready-to-run server file and only the small, truly necessary set of dependency files. Nothing extra, nothing wasted.

### `COPY --from=builder /app/.next/static ./.next/static`

The standalone folder deliberately does not include the compiled static assets (things like JavaScript bundle files, CSS stylesheets, and images that a user's web browser needs to download when visiting your site). So this separate line copies just those static files over as well, placing them into a matching `.next/static` folder so the running server can find them in the expected location.

### `COPY --from=builder /app/public ./public`

Same as before: copy over the `public` folder containing any publicly accessible static files, like a favicon icon or other images.

### Notice What's Missing: No `RUN` Commands At All

If you look carefully at this entire runner stage, you'll notice there is no `RUN npm install`, no `RUN npm ci`, and in fact, no `RUN` command of any kind. This is completely intentional, and it's possible precisely because the standalone folder we copied over already includes everything necessary to run the application, dependencies and all. There's genuinely nothing left that needs to be installed at this point.

### `EXPOSE 3000`

Exactly the same meaning as in the old Dockerfile: this documents that the app listens on port 3000, without actually opening that port up by itself.

### `CMD ["server.js"]`

This line looks a little unusual if you're used to seeing `CMD ["npm", "start"]`, so let's carefully understand what's different here.

In the old Dockerfile, this line ran `npm start`, which then had to go looking inside `package.json` for a script named "start," which then finally ran `next start` to boot up the server. That's three separate steps happening one after another.

In this new version, there's no `npm` involved at all anymore (remember, the distroless image doesn't even have npm installed on it in the first place!). Instead, this line directly tells Docker to run a file called `server.js`. This file is the exact same ready-made server program that Next.js automatically generated for us earlier, inside that standalone folder, back when we ran the build step with the standalone setting turned on. Running it directly skips the entire "ask npm, which asks package.json, which asks next" chain, and goes straight to starting the server.

## But Wait — Where Did the Word "node" Go?

If you look closely, you might notice something odd: the command is simply `CMD ["server.js"]`, without the word "node" anywhere in front of it. Normally, to run any JavaScript file using Node.js, you'd type something like `node server.js` on your own computer. So how does Docker know to use Node here?

This brings us to one final new word: **entrypoint**. An entrypoint is basically a fixed, built-in "default program" that a Docker image is already configured to always run first, no matter what. Think of it like a vending machine that is permanently wired to always dispense a snack whenever you press a button; you don't need to tell it "please act like a vending machine and dispense a snack" every single time, because that behavior is already built into the machine itself. You only need to tell it *which* specific button to press.

The distroless Node.js image we used here already has its entrypoint permanently set to the Node.js program itself. Conceptually, it's a bit like the image already secretly contains a hidden line similar to:

```
ENTRYPOINT ["node"]
```

Because of this, whenever the Dockerfile writes `CMD ["server.js"]`, Docker automatically combines the image's built-in entrypoint together with this command, and effectively ends up running `node server.js`, even though the word "node" was never typed out in this particular Dockerfile at all. In our vending machine example, `CMD ["server.js"]` is simply "pressing the button" that tells the machine which specific snack (file) to dispense (run).

## What If You Had Used `node:22-slim` Instead of Distroless Here?

If, instead, you had tried to use the regular `node:22-slim` image for this final runner stage, this shortcut would not work the same way, because that particular image does not come with Node already set as its automatic default entrypoint. In that case, you would need to be fully explicit and write:

```dockerfile
CMD ["node", "server.js"]
```

so that Docker clearly understands exactly which program (`node`) should be used to run your file (`server.js`).

---

# Why the Image Size Dropped So Dramatically: All the Reasons Together

Now that every single line of both Dockerfiles has been explained, let's collect all the reasons behind the size drop from 1.7 GB down to 311 MB into one clear list. It's worth remembering that this improvement is not caused by just one single trick; it comes from several smaller improvements all working together at the same time.

## Reason 1: Turning On Standalone Output (The Biggest Reason)

In the old approach, the entire `.next` folder gets copied into the final image, and that folder is packed with plenty of material that isn't actually needed just to run the app, such as internal build caches and trace files. Once the `output: "standalone"` setting is turned on, Next.js automatically prepares a slimmed-down "takeaway box" folder containing only what's genuinely required. This single change accounts for the largest chunk of the total size reduction.

## Reason 2: No More Installing Dependencies a Second Time

The old Dockerfile's runner stage runs `npm ci --only=production`, reinstalling a whole set of dependencies even though the builder stage had already installed dependencies once already. The new Dockerfile's runner stage has no install commands at all, because the standalone folder already comes bundled with exactly the small set of node modules it actually needs. Nothing gets installed twice.

## Reason 3: Switching to a Distroless Base Image for the Runner Stage

The old runner stage is based on `node:22-slim`, which includes a full mini Linux system complete with a shell and various command-line tools. The new runner stage is based on a distroless image, which strips all of that extra material away and keeps only the Node.js runtime plus the essential shared libraries it truly needs. Removing all of that extra software meaningfully shrinks the overall image size.

## Reason 4: No Duplicate Sets of node_modules

Because the old Dockerfile installs dependencies once in the builder stage and then again in the runner stage, it effectively ends up carrying two separate sets of installed packages across the whole build process. The new Dockerfile installs dependencies only once, in the builder stage, and the runner stage simply reuses the already-minimal node modules bundled inside the standalone output.

## Reason 5: No Package Manager Present in the Final Image

Programs like npm take up disk space of their own, even when they're not actively being used. The distroless base image used in the new version removes the package manager entirely from the final runtime image, since it isn't needed anymore once the application has already been fully built and packaged up.

## Reason 6: No Shell Program Present in the Final Image

The old image includes shell programs like `bash` and `sh`, which are small command-line interpreters. These aren't required at all just to run an already-compiled Next.js server, and the distroless image removes them completely, which also improves security, since an attacker with access to the container would have no shell available to poke around with.

## Reason 7: No Extra General-Purpose Linux Utilities

The old Node Slim image comes bundled with a range of general Debian Linux utility programs and the `apt` package manager (a tool used to install more Linux software). None of these are ever required just to run a Node.js server process, and the distroless image leaves all of them out entirely.

## Side-by-Side Comparison Table

| Feature | Old Multi-Stage Dockerfile | New Optimized Dockerfile |
|---|---|---|
| Has a separate Builder Stage | Yes | Yes |
| Runner Stage's Base Image | node:22-slim | Distroless |
| npm Present in Final Image | Yes | No |
| Shell Present in Final Image | Yes | No |
| apt Present in Final Image | Yes | No |
| Dependencies Reinstalled in Runner Stage | Yes | No |
| Uses Next.js Standalone Output Setting | No | Yes |
| Copies the Entire .next Folder | Yes | No |
| Copies Only the Minimum Required Files | No | Yes |
| Typical Final Image Size | Around 1.7 GB | Around 311 MB |

---

# How to Explain This Approach in an Interview

If an interviewer ever asks why a particular Dockerfile design was chosen for a Next.js project, a strong and complete answer would sound something like this: the initial approach used a standard multi-stage Dockerfile with a regular Node.js runtime image, which worked correctly but produced an image around 1.7 GB in size, mainly because it copied the entire build output folder and then reinstalled production dependencies a second time inside the runner stage, even though they had already been installed once earlier. This was then optimized in two connected steps: first, by turning on Next.js's standalone output setting in the project's configuration file, which causes the build process to automatically bundle only the exact files required to run the application, including a ready-made server file; and second, by switching the runner stage over to a distroless Node.js base image, which removes unnecessary tools like the shell, the package manager, and npm entirely from the final image. Together, these two changes brought the final image size down to about 311 MB, while also improving startup speed, reducing the overall attack surface, and following widely recognized production best practices for containerized applications.

---

# Summary

This topic walked through a real, practical example of Docker image optimization for a Next.js application, comparing a straightforward multi-stage Dockerfile that produced a 1.7 GB image against a much leaner version that produces only about 311 MB, without changing what the application actually does for its users.

The old Dockerfile's biggest weaknesses were that it copied the entire `.next` build folder, which is filled with unnecessary internal caches and intermediate files, and that it reinstalled production dependencies a second time in the runner stage, even though those dependencies had already been installed once earlier in the builder stage. On top of that, its base runtime image, `node:22-slim`, carried along a full mini Linux environment complete with a shell, a package manager, and various command-line utilities that are never actually needed just to run an already-compiled web server.

The optimized approach fixed all of these problems together, starting with one small but essential configuration change: turning on `output: "standalone"` inside the Next.js configuration file. This single setting causes the build process to automatically generate a minimal, self-contained "takeaway box" folder holding only the exact files needed to run the application, including an automatically generated `server.js` file. From there, the Dockerfile was rewritten to copy over only that minimal folder, instead of the entire messy build output, and the runner stage's base image was switched to a distroless Node.js image, which strips away the shell, the package manager, and other unnecessary Linux tools entirely, leaving behind only the Node.js runtime and the essential shared libraries it truly needs. Because the standalone output already included every dependency required, no separate installation step was needed at all inside the final runner stage.

An important underlying detail worth remembering is exactly how the application starts up in each version. In the old version, the container runs `npm start`, which reads `package.json`, finds the script named "start," and hands things off to `next start`, which then finally boots up the Next.js server; that's three steps happening one after another. In the new version, the container instead runs the automatically generated `server.js` file directly, relying on the distroless image's built-in Node "entrypoint" (its permanently wired default program) to automatically know to run it using Node, completely skipping npm and the whole script-lookup process in between.

The key lesson to take away from all of this is that meaningful Docker image size reductions almost never come from just one single trick. They come from carefully combining several smaller improvements together: turning on a build setting that produces only the minimal required output instead of the entire build folder, avoiding repeated or unnecessary installation steps, and choosing a base runtime image that includes only what is strictly necessary to actually run the application. Applying this same kind of careful, step-by-step thinking to other kinds of projects, not just Next.js applications, is a genuinely valuable and widely applicable skill in real-world backend and DevOps engineering work.
