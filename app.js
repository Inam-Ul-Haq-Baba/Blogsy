import express from "express";
import db from "./db/db.js";
import multer from "multer";
import bcrypt from "bcrypt";
import session from "express-session";
import dotenv from "dotenv";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import sanitizeHtml from "sanitize-html";
import fs from "fs";
import path from "path";
import connectPgSimple from "connect-pg-simple";
import { fileURLToPath } from "url";
import { fileTypeFromFile } from "file-type";
import { csrfSync } from "csrf-sync";
import { sendPasswordResetEmail } from "./utils/mailer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config();

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const upload = multer({
    dest: "public/uploads/",
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(
                "Only JPG, PNG, WEBP, and GIF images are allowed."
            ));
        }
    }
});



db.connect((err) => {
    if (err) {
        console.error("Database connection failed : ", err.message)
    } else {
        console.log("Database Connection Successfull")
    }
});

const PostgreSQLStore = connectPgSimple(session);

const sessionStore = new PostgreSQLStore({
    conObject: {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT)
    },
    tableName: "session",
    createTableIfMissing: false
});

app.set("trust proxy", 1);

app.use(cookieParser(process.env.SESSION_SECRET));

// Session Middleware
app.use(session({
    name: "blogsy.sid",
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000
    }
}));


// Cookie Middleware
app.use((req, res, next) => {
    let visitorId = req.signedCookies?.blogsyVisitorId;

    if (
        typeof visitorId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(visitorId)
    ) {
        visitorId = crypto.randomUUID();

        res.cookie("blogsyVisitorId", visitorId, {
            signed: true,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 365 * 24 * 60 * 60 * 1000,
            path: "/"
        });
    }

    req.visitorId = visitorId;
    next();
});



app.use((req, res, next) => {
    let visitorId = req.signedCookies?.blogsyVisitorId;

    if (!visitorId) {
        visitorId = crypto.randomUUID();

        res.cookie("blogsyVisitorId", visitorId, {
            signed: true,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 365 * 24 * 60 * 60 * 1000,
            path: "/"
        });
    }

    req.visitorId = visitorId;
    next();
});



const {
    csrfSynchronisedProtection,
    generateToken
} = csrfSync({
    getTokenFromRequest: (req) => {
        if (req.is("multipart/form-data")) {
            return req.body?._csrf;
        }

        return req.body?._csrf;
    }
});

app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req);
    next();
});

// app.use(csrfSynchronisedProtection);



app.use((req, res, next) => {
    if (req.session.userId) {
        res.locals.user = {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail
        };
    } else {
        res.locals.user = null;
    }

    next();
});

// Authentication Middleware

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        // Return JSON for AJAX/fetch requests
        if (req.path.endsWith("/like")) {
            return res.status(401).json({
                success: false,
                message: "Please log in to like a blog."
            });
        }

        // Redirect normal page requests to login
        return res.redirect("/login");
    }

    next();
}


const allCategories = [
    "Technology",
    "Programming",
    "Web Development",
    "Mobile Development",
    "Artificial Intelligence",
    "Data Science",
    "Cybersecurity",
    "Databases",
    "Software Engineering",
    "Cloud Computing",
    "DevOps",
    "Education",
    "Career & Jobs",
    "Freelancing",
    "Productivity",
    "Personal Growth",
    "Business & Finance",
    "Lifestyle",
    "Travel",
    "Reviews",
    "Tutorials",
    "News & Updates",
    "Other"
];

// Categories Middleware

app.use((req, res, next) => {
    res.locals.categories = allCategories;
    next();
});


app.get("/", async (req, res) => {
    const requestedPage = Math.max(
        1,
        parseInt(req.query.page, 10) || 1
    );

    const limit = 12;

    try {
        const countResult = await db.query(
            "SELECT COUNT(*) FROM posts"
        );

        const totalPosts = Number(countResult.rows[0].count);
        const totalPages = Math.min(
            10,
            Math.max(1, Math.ceil(totalPosts / limit))
        );

        const currentPage = Math.min(
            requestedPage,
            Math.max(1, totalPages)
        );

        const offset = (currentPage - 1) * limit;

        const postsResult = await db.query(
            `SELECT
                posts.*,
                COUNT(post_likes.user_id)::INTEGER AS like_count,
                COALESCE(
                    BOOL_OR(post_likes.user_id = $1),
                    FALSE
                ) AS user_liked
            FROM posts
            LEFT JOIN post_likes
                ON posts.id = post_likes.post_id
            GROUP BY posts.id
            ORDER BY
                (posts.views * 0.5
                + COUNT(post_likes.user_id) * 0.3
                + GREATEST(
                    0,
                    1 - EXTRACT(
                        EPOCH FROM (NOW() - posts.date::timestamp)
                    ) / (30 * 24 * 60 * 60)
                ) * 100 * 0.2) DESC,
                posts.id DESC
            LIMIT $2 OFFSET $3`,
            [req.session.userId || null, limit, offset]
        );

        const success = req.query.published === "true"
            ? "Your blog has been published successfully!"
            : null;

        res.render("index.ejs", {
            posts: postsResult.rows,
            currentPage,
            totalPages,
            success
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Database error");
    }
});


app.get("/posts/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).send("Invalid blog ID");
    }

    try {
        // Check whether the post exists
        const postResult = await db.query(
            "SELECT * FROM posts WHERE id = $1",
            [id]
        );

        if (postResult.rows.length === 0) {
            return res.status(404).send("Post not found");
        }

        // Count one view per registered user per post

        await db.query("BEGIN");

        try {
            let viewResult;

            if (req.session.userId) {
                // Registered users: one view per user per post
                viewResult = await db.query(
                    `INSERT INTO post_views (post_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (post_id, user_id) DO NOTHING
             RETURNING post_id`,
                    [id, req.session.userId]
                );
            } else {
                // Anonymous visitors: one view per browser per post
                viewResult = await db.query(
                    `INSERT INTO post_anonymous_views (post_id, visitor_id)
             VALUES ($1, $2)
             ON CONFLICT (post_id, visitor_id) DO NOTHING
             RETURNING post_id`,
                    [id, req.visitorId]
                );
            }

            // Increase views only when a new unique record was inserted
            if (viewResult.rows.length > 0) {
                await db.query(
                    `UPDATE posts
             SET views = views + 1
             WHERE id = $1`,
                    [id]
                );
            }

            await db.query("COMMIT");
        } catch (err) {
            await db.query("ROLLBACK");
            throw err;
        }


        // Fetch the latest post data, including its view count
        const updatedPostResult = await db.query(
            "SELECT * FROM posts WHERE id = $1",
            [id]
        );

        const likesResult = await db.query(
            `SELECT
                COUNT(*)::INTEGER AS like_count,
                COALESCE(
                    BOOL_OR(user_id = $2),
                    FALSE
                ) AS user_liked
             FROM post_likes
             WHERE post_id = $1`,
            [id, req.session.userId || null]
        );

        const commentsResult = await db.query(
            `SELECT comments.*, users.name AS author
             FROM comments
             JOIN users ON comments.user_id = users.id
             WHERE comments.post_id = $1
             ORDER BY comments.created_at DESC`,
            [id]
        );

        const success = req.query.commentUpdated === "true"
            ? "Your comment has been updated successfully."
            : req.query.commentDeleted === "true"
                ? "Your comment has been deleted successfully."
                : null;

        const post = updatedPostResult.rows[0];

        post.formattedContent = sanitizeHtml(
            post.content || "",
            {
                allowedTags: [
                    "p", "br", "strong", "b", "em", "i", "u", "s",
                    "h1", "h2", "h3", "ol", "ul", "li",
                    "blockquote", "a"
                ],
                allowedAttributes: {
                    a: ["href", "target", "rel"]
                },
                allowedSchemes: ["http", "https", "mailto"],
                transformTags: {
                    a: sanitizeHtml.simpleTransform(
                        "a",
                        { target: "_blank", rel: "noopener noreferrer" },
                        true
                    )
                }
            }
        );

        res.render("post.ejs", {
            post: post,
            comments: commentsResult.rows,
            success,
            likeCount: likesResult.rows[0].like_count,
            userLiked: likesResult.rows[0].user_liked
        });

    } catch (err) {
        console.error("Post detail error:", err.message);
        res.status(500).send("Database error");
    }
});



// Post Like
app.post("/posts/:id/like", requireLogin, csrfSynchronisedProtection, async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid blog ID."
        });
    }

    try {
        // Check whether the blog exists
        const postResult = await db.query(
            "SELECT id FROM posts WHERE id = $1",
            [id]
        );

        if (postResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Blog not found."
            });
        }

        // Check whether the user has already liked this blog
        const existingLike = await db.query(
            `SELECT 1
                 FROM post_likes
                 WHERE post_id = $1 AND user_id = $2`,
            [id, req.session.userId]
        );

        let liked;

        if (existingLike.rows.length > 0) {
            await db.query(
                `DELETE FROM post_likes
                     WHERE post_id = $1 AND user_id = $2`,
                [id, req.session.userId]
            );

            liked = false;
        } else {
            await db.query(
                `INSERT INTO post_likes (post_id, user_id)
                     VALUES ($1, $2)
                     ON CONFLICT (post_id, user_id) DO NOTHING`,
                [id, req.session.userId]
            );

            liked = true;
        }

        const countResult = await db.query(
            `SELECT COUNT(*)::INTEGER AS like_count
                 FROM post_likes
                 WHERE post_id = $1`,
            [id]
        );

        return res.json({
            success: true,
            liked,
            likeCount: countResult.rows[0].like_count
        });

    } catch (err) {
        console.error("Like route error:", err.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update like. Please try again."
        });
    }
}
);



app.get("/create", requireLogin, (req, res) => {
    res.render("create.ejs");
});





app.post("/create", requireLogin, (req, res, next) => {
    upload.single("image")(req, res, (err) => {
        if (err) {
            let errorMessage =
                "There was a problem uploading your image.";

            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    errorMessage =
                        "Image must be smaller than 5 MB.";
                }
            } else {
                errorMessage = err.message;
            }

            return res.status(400).render("create.ejs", {
                error: errorMessage
            });
        }

        next();
    });
}, (req, res, next) => {
    csrfSynchronisedProtection(req, res, async (err) => {
        if (err) {
            if (req.file) {
                try {
                    await fs.promises.unlink(req.file.path);
                } catch (cleanupError) {
                    if (cleanupError.code !== "ENOENT") {
                        console.error(
                            "Failed to clean up uploaded image:",
                            cleanupError.message
                        );
                    }
                }
            }

            return next(err);
        }

        next();
    });
}, async (req, res) => {

    // Delete an uploaded image if processing fails
    const deleteUploadedImage = async () => {
        if (!req.file) return;

        const imagePath = path.join(
            __dirname,
            "public",
            "uploads",
            req.file.filename
        );

        try {
            await fs.promises.unlink(imagePath);
        } catch (err) {
            if (err.code !== "ENOENT") {
                console.error(
                    "Failed to delete uploaded image:",
                    err.message
                );
            }
        }
    };


    if (req.file) {
        try {
            const detectedType = await fileTypeFromFile(req.file.path);

            const allowedMimeTypes = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif"
            ];

            if (
                !detectedType ||
                !allowedMimeTypes.includes(detectedType.mime)
            ) {
                await deleteUploadedImage();

                return res.status(400).render("create.ejs", {
                    error: "The uploaded file is not a valid supported image."
                });
            }
        } catch (err) {
            await deleteUploadedImage();

            console.error("Image verification failed:", err.message);

            return res.status(400).render("create.ejs", {
                error: "Unable to verify the uploaded image. Please try another file."
            });
        }
    }


    const title = (req.body.title || "").trim();
    const description = (req.body.description || "").trim();
    const content = sanitizeHtml(
        (req.body.content || "").trim(),
        {
            allowedTags: [
                "p", "br", "strong", "b", "em", "i", "u", "s",
                "h1", "h2", "h3", "ol", "ul", "li",
                "blockquote", "a"
            ],
            allowedAttributes: {
                a: ["href", "target", "rel"]
            },
            allowedSchemes: ["http", "https", "mailto"],
            transformTags: {
                a: sanitizeHtml.simpleTransform(
                    "a",
                    { target: "_blank", rel: "noopener noreferrer" },
                    true
                )
            }
        }
    );

    const category = (req.body.category || "")
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, char => char.toUpperCase());

    // Validate required fields
    if (!title || !category || !description || !content) {
        await deleteUploadedImage();

        return res.status(400).render("create.ejs", {
            error: "Please fill in all required fields."
        });
    }

    // Validate field lengths
    if (
        title.length > 255 ||
        category.length > 100 ||
        description.length > 500 ||
        content.length > 20000
    ) {
        await deleteUploadedImage();

        return res.status(400).render("create.ejs", {
            error: "One or more fields exceed the allowed length."
        });
    }

    // Allowed categories
    const allowedCategories = allCategories;

    // Validate category
    if (!allowedCategories.includes(category)) {
        await deleteUploadedImage();

        return res.status(400).render("create.ejs", {
            error: "Please select a valid category."
        });
    }

    const author = req.session.userName;
    const userId = req.session.userId;

    const image = req.file
        ? `/uploads/${req.file.filename}`
        : `/images/default_image.png`;

    const query = `
        INSERT INTO posts
        (title, category, description, content, author, date, image, user_id)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7)
    `;

    const values = [
        title,
        category,
        description,
        content,
        author,
        image,
        userId
    ];

    try {
        await db.query(query, values);

        return res.redirect("/?published=true");
    } catch (err) {
        console.error("Failed to create post:", err.message);

        await deleteUploadedImage();

        return res.status(500).send(
            "Unable to publish your blog. Please try again."
        );
    }
});



app.get("/about", (req, res) => {
    res.render("about.ejs")
})

app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.post("/register", csrfSynchronisedProtection, async (req, res) => {
    const { name, email, password } = req.body;

    const username = req.body.username?.trim().toLowerCase();
    const normalizedName = name?.trim();
    const normalizedEmail = email?.trim().toLowerCase();

    // Validate required fields
    if (!normalizedName || !username || !normalizedEmail || !password) {
        return res.status(400).render("register.ejs", {
            error: "Please fill in all required fields.",
            name: normalizedName,
            username,
            email: normalizedEmail
        });
    }

    // Validate name
    if (normalizedName.length > 100) {
        return res.status(400).render("register.ejs", {
            error: "Name must not exceed 100 characters.",
            name: normalizedName,
            username,
            email: normalizedEmail
        });
    }

    // Validate username
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        return res.status(400).render("register.ejs", {
            error: "Username must contain 3–30 letters, numbers, or underscores.",
            name: normalizedName,
            username,
            email: normalizedEmail
        });
    }

    // Validate password length
    if (password.length < 8) {
        return res.status(400).render("register.ejs", {
            error: "Password must contain at least 8 characters.",
            name: normalizedName,
            username,
            email: normalizedEmail
        });
    }

    if (password.length > 72) {
        return res.status(400).render("register.ejs", {
            error: "Password must not exceed 72 characters.",
            name: normalizedName,
            username,
            email: normalizedEmail
        });
    }

    try {
        // Check whether the email is already registered
        const existingEmail = await db.query(
            `SELECT id FROM users
             WHERE LOWER(email) = $1`,
            [normalizedEmail]
        );

        if (existingEmail.rows.length > 0) {
            return res.status(400).render("register.ejs", {
                error: "This email is already registered.",
                name: normalizedName,
                username,
                email: normalizedEmail
            });
        }

        // Check whether the username is already taken
        const existingUsername = await db.query(
            `SELECT id FROM users
             WHERE LOWER(username) = $1`,
            [username]
        );

        if (existingUsername.rows.length > 0) {
            return res.status(400).render("register.ejs", {
                error: "This username is already taken. Please choose another.",
                name: normalizedName,
                username,
                email: normalizedEmail
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        await db.query(
            `INSERT INTO users (name, username, email, password)
             VALUES ($1, $2, $3, $4)`,
            [
                normalizedName,
                username,
                normalizedEmail,
                hashedPassword
            ]
        );

        // Redirect to login
        return res.redirect("/login?registered=true");

    } catch (err) {
        console.error("Registration error:", err.message);

        // Handle duplicate email or username race conditions
        if (err.code === "23505") {
            return res.status(400).render("register.ejs", {
                error: "That email or username is already in use. Please try another.",
                name: normalizedName,
                username,
                email: normalizedEmail
            });
        }

        return res.status(500).render("register.ejs", {
            error: "Registration failed. Please try again.",
            name: normalizedName,
            username,
            email: normalizedEmail
        });
    }
});


// Login Route

app.get("/login", (req, res) => {
    let success = null;

    if (req.query.passwordReset === "true") {
        success = "Your password has been reset successfully. Please log in.";
    } else if (req.query.registered === "true") {
        success = "Your account has been created successfully. Please log in.";
    }

    res.render("login.ejs", { success });
});

app.post("/login", csrfSynchronisedProtection, async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const result = await db.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).render("login.ejs", {
                error: "Invalid email or password.",
                email
            });
        }

        const user = result.rows[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).render("login.ejs", {
                error: "Invalid email or password.",
                email
            });
        }

        // Preserve the anonymous visitor ID before regenerating the session
        const visitorId = req.visitorId;

        req.session.regenerate(async (err) => {
            if (err) {
                console.error("Session regeneration failed:", err.message);
                return res.status(500).send(
                    "Login failed. Please try again."
                );
            }

            try {
                // Store authenticated user information
                req.session.userId = user.id;
                req.session.userName = user.name;
                req.session.userEmail = user.email;

                // Transfer anonymous views without increasing views again
                if (visitorId) {
                    await db.query(
                        `INSERT INTO post_views (post_id, user_id)
                         SELECT post_id, $2
                         FROM post_anonymous_views
                         WHERE visitor_id = $1
                         ON CONFLICT (post_id, user_id) DO NOTHING`,
                        [visitorId, user.id]
                    );

                    // Remove the transferred anonymous records
                    await db.query(
                        `DELETE FROM post_anonymous_views
                         WHERE visitor_id = $1`,
                        [visitorId]
                    );
                }

                // Save the new session before redirecting
                req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error(
                            "Session save failed:",
                            saveErr.message
                        );

                        return res.status(500).send(
                            "Login failed. Please try again."
                        );
                    }

                    res.redirect("/");
                });
            } catch (transferErr) {
                console.error(
                    "Anonymous view transfer failed:",
                    transferErr.message
                );

                return res.status(500).send(
                    "Login failed. Please try again."
                );
            }
        });
    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).send("Login failed");
    }
});


// Logout Route
app.post("/logout", csrfSynchronisedProtection, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err.message);
            return res.status(500).send("Unable to log out. Please try again.");
        }

        res.clearCookie("blogsy.sid");
        res.redirect("/");
    });
});


// Forgot Password Route
app.get("/forgot-password", (req, res) => {
    res.render("forgot-password.ejs", {
        error: null,
        success: null
    });
});

app.post("/forgot-password", csrfSynchronisedProtection, async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();

    // Always use the same response to avoid revealing registered emails.
    const genericMessage =
        "If an account exists for that email, a password reset link will be sent shortly.";

    if (!email || email.length > 254) {
        return res.status(200).render("forgot-password.ejs", {
            error: null,
            success: genericMessage
        });
    }

    let user;

    try {
        const result = await db.query(
            "SELECT id, email FROM users WHERE LOWER(email) = $1",
            [email]
        );

        user = result.rows[0];

        // Do not reveal whether the email exists.
        if (!user) {
            return res.render("forgot-password.ejs", {
                error: null,
                success: genericMessage
            });
        }

        // Invalidate earlier reset links for this account.
        await db.query(
            "DELETE FROM password_reset_tokens WHERE user_id = $1",
            [user.id]
        );

        // Generate a secure, unpredictable token.
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        await db.query(
            `INSERT INTO password_reset_tokens
                (user_id, token_hash, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
            [user.id, tokenHash]
        );

        const baseUrl = process.env.APP_BASE_URL;

        if (!baseUrl) {
            throw new Error("APP_BASE_URL is not configured.");
        }

        const resetUrl =
            `${baseUrl.replace(/\/$/, "")}/reset-password/${rawToken}`;

        try {
            await sendPasswordResetEmail(user.email, resetUrl);
        } catch (emailError) {
            // Remove the unusable token if sending fails.
            await db.query(
                "DELETE FROM password_reset_tokens WHERE token_hash = $1",
                [tokenHash]
            );

            throw emailError;
        }

        return res.render("forgot-password.ejs", {
            error: null,
            success: genericMessage
        });
    } catch (err) {
        console.error("Password reset request failed:", err.message);

        // Keep the public response generic even when processing fails.
        return res.status(200).render("forgot-password.ejs", {
            error: null,
            success: genericMessage
        });
    }
});


// Reset Password Routes
app.get("/reset-password/:token", async (req, res) => {
    const { token } = req.params;

    if (!/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(400).send(
            "This password reset link is invalid or expired."
        );
    }

    try {
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const result = await db.query(
            `SELECT id
             FROM password_reset_tokens
             WHERE token_hash = $1
               AND expires_at > NOW()`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return res.status(400).send(
                "This password reset link is invalid or expired."
            );
        }

        return res.render("reset-password.ejs", {
            token,
            error: null
        });
    } catch (err) {
        console.error("Reset page error:", err.message);
        return res.status(500).send("Unable to open the reset page.");
    }
});


app.post(
    "/reset-password/:token",
    csrfSynchronisedProtection,
    async (req, res) => {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        const renderError = (message, status = 400) =>
            res.status(status).render("reset-password.ejs", {
                token,
                error: message
            });

        if (!/^[a-f0-9]{64}$/i.test(token)) {
            return res.status(400).send(
                "This password reset link is invalid or expired."
            );
        }

        if (
            typeof password !== "string" ||
            typeof confirmPassword !== "string"
        ) {
            return renderError("Please enter both password fields.");
        }

        if (password.length < 8 || password.length > 72) {
            return renderError(
                "Password must contain between 8 and 72 characters."
            );
        }

        if (password !== confirmPassword) {
            return renderError("The passwords do not match.");
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        try {
            // Hash the password before updating the account.
            const hashedPassword = await bcrypt.hash(password, 10);

            // Consume the token and update the password atomically.
            await db.query("BEGIN");

            const tokenResult = await db.query(
                `SELECT user_id
                 FROM password_reset_tokens
                 WHERE token_hash = $1
                   AND expires_at > NOW()
                 FOR UPDATE`,
                [tokenHash]
            );

            if (tokenResult.rows.length === 0) {
                await db.query("ROLLBACK");
                return res.status(400).send(
                    "This password reset link is invalid or expired."
                );
            }

            const userId = tokenResult.rows[0].user_id;

            await db.query(
                "UPDATE users SET password = $1 WHERE id = $2",
                [hashedPassword, userId]
            );

            // Remove all reset links for this account.
            await db.query(
                "DELETE FROM password_reset_tokens WHERE user_id = $1",
                [userId]
            );

            await db.query("COMMIT");

            return res.redirect("/login?passwordReset=true");
        } catch (err) {
            await db.query("ROLLBACK").catch(() => { });
            console.error("Password update error:", err.message);

            return renderError(
                "Unable to reset your password. Please try again.",
                500
            );
        }
    }
);



// My blogs
app.get("/my-blogs", requireLogin, async (req, res) => {
    const userId = req.session.userId;

    try {
        const result = await db.query(
            `SELECT
                posts.*,
                COUNT(post_likes.user_id)::INTEGER AS like_count,
                COALESCE(
                    BOOL_OR(post_likes.user_id = $2),
                    FALSE
                ) AS user_liked
             FROM posts
             LEFT JOIN post_likes
                ON posts.id = post_likes.post_id
             WHERE posts.user_id = $1
             GROUP BY posts.id
             ORDER BY posts.date DESC, posts.id DESC`,
            [userId, userId]
        );

        const success = req.query.updated === "true"
            ? "Your blog has been updated successfully."
            : req.query.deleted === "true"
                ? "Your blog has been deleted successfully."
                : null;

        res.render("my-blogs.ejs", {
            posts: result.rows,
            success
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Database error");
    }
});



// search
app.get("/search", async (req, res) => {
    const searchTerm = req.query.q || "";

    try {
        const result = await db.query(
            `SELECT
                posts.*,
                users.name AS author,
                COUNT(post_likes.user_id)::INTEGER AS like_count,
                COALESCE(
                    BOOL_OR(post_likes.user_id = $2),
                    FALSE
                ) AS user_liked
             FROM posts
             LEFT JOIN users
                ON posts.user_id = users.id
             LEFT JOIN post_likes
                ON posts.id = post_likes.post_id
             WHERE posts.title ILIKE $1
                OR posts.category ILIKE $1
                OR users.name ILIKE $1
             GROUP BY posts.id, users.name
             ORDER BY posts.date DESC, posts.id DESC`,
            [`%${searchTerm.trim()}%`, req.session.userId || null]
        );

        res.render("search.ejs", {
            posts: result.rows,
            searchTerm
        });
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).send("Database error");
    }
});


app.get("/posts/:id/edit", requireLogin, async (req, res) => {
    const postId = Number(req.params.id);
    const userId = req.session.userId;

    if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).send("Invalid blog ID");
    }

    try {
        const result = await db.query(
            "SELECT * FROM posts WHERE id = $1 AND user_id = $2",
            [postId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Blog not found");
        }

        res.render("edit.ejs", { post: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Database error");
    }
});


// Edit Post
app.post("/posts/:id/edit", requireLogin, (req, res, next) => {
    upload.single("image")(req, res, async (err) => {
        if (err) {
            let errorMessage =
                "There was a problem uploading your image.";

            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    errorMessage = "Image must be smaller than 5 MB.";
                }
            } else {
                errorMessage = err.message;
            }

            return res.status(400).render("edit.ejs", {
                error: errorMessage
            });
        }

        next();
    });
}, (req, res, next) => {
    csrfSynchronisedProtection(req, res, async (err) => {
        if (err) {
            if (req.file) {
                try {
                    await fs.promises.unlink(req.file.path);
                } catch (cleanupError) {
                    if (cleanupError.code !== "ENOENT") {
                        console.error(
                            "Failed to clean up uploaded image:",
                            cleanupError.message
                        );
                    }
                }
            }

            return next(err);
        }

        next();
    });
}, async (req, res) => {
    const postId = Number(req.params.id);
    const userId = req.session.userId;

    const title =
        typeof req.body.title === "string"
            ? req.body.title.trim()
            : "";

    const description =
        typeof req.body.description === "string"
            ? req.body.description.trim()
            : "";

    const content =
        typeof req.body.content === "string"
            ? req.body.content.trim()
            : "";

    const category =
        typeof req.body.category === "string"
            ? req.body.category.trim()
                .toLowerCase()
                .replace(/\b\w/g, char => char.toUpperCase())
            : "";

    const deleteUploadedImage = async () => {
        if (!req.file) return;

        try {
            await fs.promises.unlink(req.file.path);
        } catch (err) {
            if (err.code !== "ENOENT") {
                console.error("Failed to delete uploaded image:", err.message);
            }
        }
    };

    if (!Number.isInteger(postId) || postId <= 0) {
        await deleteUploadedImage();
        return res.status(400).send("Invalid blog ID");
    }

    try {
        const existing = await db.query(
            "SELECT image FROM posts WHERE id = $1 AND user_id = $2",
            [postId, userId]
        );

        if (existing.rows.length === 0) {
            await deleteUploadedImage();
            return res.status(404).send("Blog not found");
        }

        // Verify the actual uploaded file contents.
        if (req.file) {
            const detectedType = await fileTypeFromFile(req.file.path);

            const allowedMimeTypes = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif"
            ];

            if (!detectedType || !allowedMimeTypes.includes(detectedType.mime)) {
                await deleteUploadedImage();

                return res.status(400).render("edit.ejs", {
                    error: "The uploaded file is not a valid supported image."
                });
            }
        }

        if (!title || !category || !description || !content) {
            await deleteUploadedImage();

            return res.status(400).render("edit.ejs", {
                error: "Please fill in all required fields."
            });
        }

        if (
            title.length > 255 ||
            category.length > 100 ||
            description.length > 500 ||
            content.length > 20000
        ) {
            await deleteUploadedImage();

            return res.status(400).render("edit.ejs", {
                error: "One or more fields exceed the allowed length."
            });
        }

        const allowedCategories = allCategories;

        if (!allowedCategories.includes(category)) {
            await deleteUploadedImage();

            return res.status(400).render("edit.ejs", {
                error: "Please select a valid category."
            });
        }

        const image = req.file
            ? `/uploads/${req.file.filename}`
            : existing.rows[0].image;

        await db.query(
            `UPDATE posts
             SET title = $1,
                 category = $2,
                 description = $3,
                 content = $4,
                 image = $5
             WHERE id = $6 AND user_id = $7`,
            [
                title,
                category,
                description,
                content,
                image,
                postId,
                userId
            ]
        );

        return res.redirect("/my-blogs?updated=true");
    } catch (err) {
        await deleteUploadedImage();

        console.error("Failed to update blog:", err.message);

        return res.status(500).send(
            "Unable to update your blog. Please try again."
        );
    }
});


app.post("/posts/:id/delete", requireLogin, csrfSynchronisedProtection, async (req, res) => {
    const postId = Number(req.params.id);
    const userId = req.session.userId;

    if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).send("Invalid blog ID");
    }

    try {
        // Find the post and verify ownership
        const existing = await db.query(
            `SELECT image
             FROM posts
             WHERE id = $1 AND user_id = $2`,
            [postId, userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).send("Blog not found");
        }

        const image = existing.rows[0].image;

        // Delete the post from the database
        await db.query(
            "DELETE FROM posts WHERE id = $1 AND user_id = $2",
            [postId, userId]
        );

        // Delete only locally uploaded images
        if (typeof image === "string") {
            const match = image.match(
                /^\/uploads\/([a-zA-Z0-9_-]+)$/
            );

            if (match) {
                const imagePath = path.join(
                    __dirname,
                    "public",
                    "uploads",
                    match[1]
                );

                try {
                    await fs.promises.unlink(imagePath);
                } catch (err) {
                    if (err.code !== "ENOENT") {
                        console.error(
                            "Failed to delete post image:",
                            err.message
                        );
                    }
                }
            }
        }

        return res.redirect("/my-blogs?deleted=true");
    } catch (err) {
        console.error("Failed to delete blog:", err.message);

        return res.status(500).send(
            "Unable to delete your blog. Please try again."
        );
    }
});



// Route to submit comments

app.post("/posts/:id/comments", requireLogin, csrfSynchronisedProtection, async (req, res) => {
    const postId = Number(req.params.id);
    const userId = req.session.userId;

    const content =
        typeof req.body.content === "string"
            ? req.body.content.trim()
            : "";

    // Validate blog ID
    if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).send("Invalid blog ID");
    }

    // Validate comment content
    if (!content) {
        return res.status(400).send("Comment cannot be empty");
    }

    if (content.length > 2000) {
        return res.status(400).send(
            "Comment must not exceed 2000 characters"
        );
    }

    try {
        // Check whether the blog post exists
        const post = await db.query(
            "SELECT id FROM posts WHERE id = $1",
            [postId]
        );

        if (post.rows.length === 0) {
            return res.status(404).send("Blog not found");
        }

        // Save the comment
        await db.query(
            `INSERT INTO comments (content, user_id, post_id)
             VALUES ($1, $2, $3)`,
            [content, userId, postId]
        );

        return res.redirect(`/posts/${postId}`);
    } catch (err) {
        console.error("Failed to create comment:", err.message);

        return res.status(500).send(
            "Unable to post your comment. Please try again."
        );
    }
});


// Get comment Route
app.get("/comments/:id/edit", requireLogin, async (req, res) => {
    const commentId = Number(req.params.id);
    const userId = req.session.userId;

    if (!Number.isInteger(commentId) || commentId <= 0) {
        return res.status(400).send("Invalid comment ID");
    }

    try {
        const result = await db.query(
            `SELECT comments.*, posts.title AS post_title
             FROM comments
             JOIN posts ON comments.post_id = posts.id
             WHERE comments.id = $1 AND comments.user_id = $2`,
            [commentId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Comment not found");
        }

        res.render("edit-comment.ejs", {
            comment: result.rows[0]
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Database error");
    }
});


// Edit Comment Route
app.post("/comments/:id/edit", requireLogin, csrfSynchronisedProtection, async (req, res) => {
    const commentId = Number(req.params.id);
    const userId = req.session.userId;
    const content = req.body.content?.trim();

    if (!Number.isInteger(commentId) || commentId <= 0) {
        return res.status(400).send("Invalid comment ID");
    }

    if (!content) {
        return res.status(400).send("Comment cannot be empty");
    }

    if (content.length > 2000) {
        return res.status(400).send("Comment must not exceed 2000 characters");
    }

    try {
        const result = await db.query(
            `UPDATE comments
             SET content = $1
             WHERE id = $2 AND user_id = $3
             RETURNING post_id`,
            [content, commentId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Comment not found");
        }

        res.redirect(`/posts/${result.rows[0].post_id}?commentUpdated=true`);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Database error");
    }
});


//Delete Comment

app.post("/comments/:id/delete", requireLogin, csrfSynchronisedProtection, async (req, res) => {
    const commentId = Number(req.params.id);
    const userId = req.session.userId;

    if (!Number.isInteger(commentId) || commentId <= 0) {
        return res.status(400).send("Invalid comment ID");
    }

    try {
        const result = await db.query(
            `DELETE FROM comments
             WHERE id = $1 AND user_id = $2
             RETURNING post_id`,
            [commentId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Comment not found");
        }

        res.redirect(`/posts/${result.rows[0].post_id}`);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Database error");
    }
});



// get the Edit profile route
app.get("/profile/edit", requireLogin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                id, name, email, username, bio,
                profile_picture, occupation, location,
                website, github_url, linkedin_url
             FROM users
             WHERE id = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("User not found");
        }

        res.render("edit-profile.ejs", {
            profile: result.rows[0],
            error: null
        });
    } catch (err) {
        console.error("Load profile error:", err.message);
        res.status(500).send("Database error");
    }
});


// Profile
app.get("/profile/:id", async (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).send("Invalid user ID");
    }

    try {
        const userResult = await db.query(
            `SELECT
                id, name, username, bio, profile_picture,
                occupation, location, website,
                github_url, linkedin_url
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).send("User not found");
        }

        const postsResult = await db.query(
            `SELECT
                posts.*,
                COUNT(post_likes.user_id)::INTEGER AS like_count,
                COALESCE(
                    BOOL_OR(post_likes.user_id = $2),
                    FALSE
                ) AS user_liked
             FROM posts
             LEFT JOIN post_likes
                ON posts.id = post_likes.post_id
             WHERE posts.user_id = $1
             GROUP BY posts.id
             ORDER BY posts.date DESC, posts.id DESC`,
            [userId, req.session.userId || null]
        );

        const statsResult = await db.query(
            `SELECT
                COALESCE(SUM(views), 0)::INTEGER AS total_views,
                COUNT(*)::INTEGER AS total_blogs
             FROM posts
             WHERE user_id = $1`,
            [userId]
        );

        const likesResult = await db.query(
            `SELECT COUNT(*)::INTEGER AS total_likes
             FROM post_likes
             JOIN posts ON posts.id = post_likes.post_id
             WHERE posts.user_id = $1`,
            [userId]
        );

        const success =
            req.query.updated === "true" &&
                req.session.userId === userId
                ? "Your profile has been updated successfully."
                : null;

        res.render("profile.ejs", {
            profile: userResult.rows[0],
            posts: postsResult.rows,
            stats: {
                totalViews: statsResult.rows[0].total_views,
                totalBlogs: statsResult.rows[0].total_blogs,
                totalLikes: likesResult.rows[0].total_likes
            },
            success
        });

    } catch (err) {
        console.error("Profile route error:", err.message);
        res.status(500).send("Database error");
    }
});


// Submit the Edited Profile
app.post(
    "/profile/edit",
    requireLogin,
    (req, res, next) => {
        upload.single("profile_picture")(req, res, async (err) => {
            if (err) {
                const userResult = await db.query(
                    `SELECT
                        id, name, email, username, bio,
                        profile_picture, occupation, location,
                        website, github_url, linkedin_url
                     FROM users
                     WHERE id = $1`,
                    [req.session.userId]
                ).catch(() => ({ rows: [] }));

                if (userResult.rows.length === 0) {
                    return res.status(400).send(
                        err.code === "LIMIT_FILE_SIZE"
                            ? "Profile picture must be smaller than 5 MB."
                            : err.message
                    );
                }

                return res.status(400).render("edit-profile.ejs", {
                    profile: userResult.rows[0],
                    error: err.code === "LIMIT_FILE_SIZE"
                        ? "Profile picture must be smaller than 5 MB."
                        : err.message
                });
            }

            next();
        });
    },
    (req, res, next) => {
        csrfSynchronisedProtection(req, res, async (err) => {
            if (err) {
                if (req.file) {
                    try {
                        await fs.promises.unlink(req.file.path);
                    } catch (cleanupErr) {
                        if (cleanupErr.code !== "ENOENT") {
                            console.error(cleanupErr.message);
                        }
                    }
                }

                return next(err);
            }

            next();
        });
    },
    async (req, res) => {
        const userId = req.session.userId;

        const name = typeof req.body.name === "string"
            ? req.body.name.trim()
            : "";

        const email = typeof req.body.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";

        const username = typeof req.body.username === "string"
            ? req.body.username.trim()
            : "";

        const bio = typeof req.body.bio === "string"
            ? req.body.bio.trim()
            : "";

        const occupation = typeof req.body.occupation === "string"
            ? req.body.occupation.trim()
            : "";

        const location = typeof req.body.location === "string"
            ? req.body.location.trim()
            : "";

        const website = typeof req.body.website === "string"
            ? req.body.website.trim()
            : "";

        const githubUrl = typeof req.body.github_url === "string"
            ? req.body.github_url.trim()
            : "";

        const linkedinUrl = typeof req.body.linkedin_url === "string"
            ? req.body.linkedin_url.trim()
            : "";

        let uploadedImage = null;

        const cleanupUpload = async () => {
            if (!req.file) return;

            try {
                await fs.promises.unlink(req.file.path);
            } catch (err) {
                if (err.code !== "ENOENT") {
                    console.error("Upload cleanup error:", err.message);
                }
            }
        };

        const renderError = async (message) => {
            await cleanupUpload();

            const currentResult = await db.query(
                `SELECT
                    id, name, email, username, bio,
                    profile_picture, occupation, location,
                    website, github_url, linkedin_url
                 FROM users
                 WHERE id = $1`,
                [userId]
            );

            if (currentResult.rows.length === 0) {
                return res.status(404).send("User not found");
            }

            return res.status(400).render("edit-profile.ejs", {
                profile: {
                    ...currentResult.rows[0],
                    name,
                    email,
                    username,
                    bio,
                    occupation,
                    location,
                    website,
                    github_url: githubUrl,
                    linkedin_url: linkedinUrl
                },
                error: message
            });
        };

        try {
            if (!name || !email) {
                return await renderError("Name and email are required.");
            }

            if (
                name.length > 100 ||
                email.length > 255 ||
                username.length > 30 ||
                bio.length > 500 ||
                occupation.length > 100 ||
                location.length > 100 ||
                website.length > 255 ||
                githubUrl.length > 255 ||
                linkedinUrl.length > 255
            ) {
                return await renderError(
                    "One or more fields exceed the allowed length."
                );
            }

            if (
                username &&
                !/^[a-zA-Z0-9_]+$/.test(username)
            ) {
                return await renderError(
                    "Username can contain only letters, numbers, and underscores."
                );
            }

            const validateUrl = (value) => {
                if (!value) return true;

                try {
                    const parsed = new URL(value);
                    return parsed.protocol === "http:" ||
                        parsed.protocol === "https:";
                } catch {
                    return false;
                }
            };

            if (
                !validateUrl(website) ||
                !validateUrl(githubUrl) ||
                !validateUrl(linkedinUrl)
            ) {
                return await renderError(
                    "Please enter valid website URLs starting with http:// or https://."
                );
            }

            const existingUser = await db.query(
                `SELECT id
                 FROM users
                 WHERE (email = $1 OR ($2 <> '' AND username = $2))
                   AND id <> $3`,
                [email, username, userId]
            );

            if (existingUser.rows.length > 0) {
                return await renderError(
                    "That email or username is already in use."
                );
            }

            if (req.file) {
                const detectedType = await fileTypeFromFile(req.file.path);

                const allowedMimeTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/gif"
                ];

                if (
                    !detectedType ||
                    !allowedMimeTypes.includes(detectedType.mime)
                ) {
                    return await renderError(
                        "Please upload a valid JPG, PNG, WEBP, or GIF image."
                    );
                }

                uploadedImage = `/uploads/${req.file.filename}`;
            }

            const result = await db.query(
                `UPDATE users
                 SET name = $1,
                     email = $2,
                     username = NULLIF($3, ''),
                     bio = NULLIF($4, ''),
                     occupation = NULLIF($5, ''),
                     location = NULLIF($6, ''),
                     website = NULLIF($7, ''),
                     github_url = NULLIF($8, ''),
                     linkedin_url = NULLIF($9, ''),
                     profile_picture = COALESCE($10, profile_picture)
                 WHERE id = $11
                 RETURNING
                    id, name, email, username, bio,
                    profile_picture, occupation, location,
                    website, github_url, linkedin_url`,
                [
                    name,
                    email,
                    username,
                    bio,
                    occupation,
                    location,
                    website,
                    githubUrl,
                    linkedinUrl,
                    uploadedImage,
                    userId
                ]
            );

            if (result.rows.length === 0) {
                await cleanupUpload();
                return res.status(404).send("User not found");
            }

            req.session.userName = result.rows[0].name;
            req.session.userEmail = result.rows[0].email;

            return res.redirect(`/profile/${userId}?updated=true`);

        } catch (err) {
            await cleanupUpload();

            if (err.code === "23505") {
                return res.status(409).send(
                    "That email or username is already in use."
                );
            }

            console.error("Update profile error:", err.message);
            return res.status(500).send("Unable to update profile.");
        }
    }
);


// Category Filtering
app.get("/category/:category", async (req, res) => {
    const category = req.params.category;

    try {
        const result = await db.query(
            `SELECT
                posts.*,
                COUNT(post_likes.user_id)::INTEGER AS like_count,
                COALESCE(
                    BOOL_OR(post_likes.user_id = $2),
                    FALSE
                ) AS user_liked
             FROM posts
             LEFT JOIN post_likes
                ON posts.id = post_likes.post_id
             WHERE posts.category ILIKE $1
             GROUP BY posts.id
             ORDER BY posts.date DESC, posts.id DESC`,
            [category, req.session.userId || null]
        );

        res.render("category.ejs", {
            posts: result.rows,
            category
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Database error");
    }
});



// CSRF Error Handler
app.use((err, req, res, next) => {
    if (err.code !== "EBADCSRFTOKEN") {
        return next(err);
    }

    return res.status(403).send(
        "Your security token is invalid or expired. Please refresh the page and try again."
    );
});


app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
})