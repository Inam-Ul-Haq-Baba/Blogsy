# Blogsy — Where Ideas Come Alive ✍️

🌐 **Live Website:** [https://blogsy-swhh.onrender.com]

Blogsy is a responsive full-stack blog web application where users can create, publish, discover, and interact with blog posts. It includes user authentication, profile management, likes, comments, search, and image uploads.

Built as a hands-on project to strengthen my frontend and backend development skills.

## 📸 Screenshots

### 🏠 Homepage
![Blogsy Homepage](screenshots/homepage.png)

### 📖 Individual Blog Post
![Blog Post](screenshots/blog-post.png)

### ✍️ Create a Blog
![Create Blog](screenshots/create-blog.png)

### ℹ️ About Page
![About Page](screenshots/about.png)

## 🚀 Features

- Responsive homepage with trending blog posts
- User registration, login, and logout
- Secure password hashing using bcrypt
- Forgot password and email-based password reset
- Create, edit, and delete blog posts
- Upload and display blog images
- Individual blog pages with dynamic URLs
- Like and unlike blog posts
- Comments with create, edit, and delete functionality
- User profiles with profile editing
- Search blogs by title, category, and author
- Browse blogs by category
- My Blogs page for managing personal posts
- View counts for blog posts
- Pagination for browsing posts
- Responsive navigation bar with a mobile menu
- CSRF protection and session management

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| HTML | Page structure |
| Tailwind CSS | Styling and responsive design |
| JavaScript | Client-side functionality |
| Node.js | Server-side runtime |
| Express.js | Routing and backend logic |
| EJS | Dynamic server-side rendering |
| PostgreSQL | Database for users, posts, comments, likes, and views |
| bcrypt | Password hashing |
| Nodemailer | Sending password-reset emails |
| Multer | Handling image uploads |
| Git & GitHub | Version control |

## 📁 Project Structure

```text
Blogsy/
├── db/
│   └── db.js
├── public/
│   ├── css/
│   │   └── output.css
│   ├── js/
│   ├── images/
│   └── uploads/
├── src/
│   └── input.css
├── utils/
│   └── mailer.js
├── views/
│   ├── partials/
│   ├── index.ejs
│   ├── post.ejs
│   ├── create.ejs
│   ├── login.ejs
│   ├── register.ejs
│   ├── forgot-password.ejs
│   ├── reset-password.ejs
│   └── ...
├── .env.example
├── .gitignore
├── app.js
├── package.json
├── package-lock.json
└── tailwind.config.js
```

*The structure above summarizes the main project folders. Your actual project may contain additional files and templates.*

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/Inam-Ul-Haq-Baba/Blogsy.git
```

### 2. Navigate to the project directory

```bash
cd Blogsy
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root and configure the required values:

```dotenv
PORT=3000

DB_USER=your_database_user
DB_HOST=localhost
DB_NAME=your_database_name
DB_PASSWORD=your_database_password
DB_PORT=5432

SESSION_SECRET=your_session_secret

EMAIL_USER=your_blogsy_email@gmail.com
EMAIL_APP_PASSWORD=your_google_app_password

APP_BASE_URL=http://localhost:3000
```

Use your actual database and email configuration. Never commit `.env` or expose credentials in your repository.

### 5. Set up the PostgreSQL database

Create a PostgreSQL database and configure the required tables for users, posts, comments, likes, sessions, and password-reset tokens.

Run the project's database schema SQL before starting the application.

### 6. Start Tailwind CSS

Open a terminal and run:

```bash
npx tailwindcss -i ./src/input.css -o ./public/css/output.css --watch
```

### 7. Start the application

Open a second terminal and run:

```bash
npm start
```

If your project does not have a start script configured, use:

```bash
node app.js
```

For development with Nodemon:

```bash
npx nodemon app.js
```

Open the application at:

```text
http://localhost:3000
```

## 🔐 Authentication and Security

- Passwords are hashed using bcrypt before being stored.
- Login sessions are managed using server-side sessions.
- PostgreSQL is used for persistent session storage.
- CSRF protection is applied to sensitive form submissions.
- Password-reset links use secure, expiring tokens.
- Environment variables are used to protect credentials and secrets.

## 🖼️ Image Uploads

Blogsy supports image uploads for blog posts. Uploaded images are validated by file type and size.

The local development setup stores uploaded images in `public/uploads/`. For production deployment, persistent image storage such as Cloudinary can be configured to ensure uploaded images remain available independently of the application server.

## 🔑 Password Reset

Users who forget their passwords can request a reset link through their registered email address. Blogsy sends the link using Nodemailer and Gmail SMTP. Reset tokens expire after 30 minutes and can only be used once.

## 🎯 Learning Objectives

This project helped me practice:

- Full-stack web development
- REST-style routing and server-side rendering
- Database integration using PostgreSQL
- User authentication and session management
- Secure password handling
- File uploads and validation
- Dynamic EJS templates and reusable partials
- Responsive UI development with Tailwind CSS
- Git and GitHub workflows

## 🔮 Future Improvements

- Cloud-based image storage integration
- Production deployment with a hosted PostgreSQL database
- Improved blog recommendations and trending algorithms
- Additional accessibility and performance improvements

## 👨‍💻 Author

**Inam Ul Haq Baba**

Blogsy was developed as a personal learning project to practice full-stack web development.

## 📄 License

This project is created for educational and learning purposes.
