import express from "express";
import posts from "./data/post.js"

const app = express();
const port = 3000;

app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));

app.get("/",(req,res)=>{
    res.render("index.ejs",{posts})
})

app.get("/posts/:id", (req, res) => {

    const post = posts.find(post => post.id === parseInt(req.params.id));

    res.render("post.ejs", { post });

    console.log(posts)
});

app.get("/create",(req,res)=>{
    res.render("create.ejs")
})

app.post("/create", (req, res) => {
    console.log(req.body);

    const newPost= {
        id: posts.length + 1,
        title: req.body.title,
        category: req.body.category,
        description: req.body.description,
        content: req.body.content,
        author: req.body.author,
        date: new Date().toDateString(),
    }

    posts.push(newPost);
    res.redirect("/")

});

app.get("/about",(req,res)=>{
    res.render("about.ejs")
})

app.listen(port,()=>{
    console.log(`Listening on http://localhost:${port}`);
})