// Simple posting website (Twiter clone kinda)
// for any question about the project ask me on facebok
// fb.com/sarkarkurdishh




const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const ObjectID = require('mongodb').ObjectID;
const ejs = require('ejs');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const multer  = require('multer')
const path = require('path')

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname)) //Appending extension
    }
  })

const upload = multer({ dest: 'uploads/images' ,
 storage: storage,
 fileFilter: (req, file, cb) => {
    if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg") {
      cb(null, true);
    } else {
      cb(null, false);
      return false;
    }
  }})
const app = express();



app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));
app.set("view engine", "ejs");
    


app.use(session({
    secret: "Secret Code", // this should be stored inside .env not here
    saveUninitialized: false,
    resave: false,
}));

app.use(cookieParser('keyboard'));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());


// DATABASE CONNECTION
  mongoose.connect("YOUR_DATABASE_CLUSTER_LINK", {
    useNewUrlParser: true, useUnifiedTopology: true 
}).then(() => {
    console.log("Successfully connected to the database");    
}).catch(err => {
    console.log('Could not connect to the database. Exiting now...', err);
    process.exit();
});

  mongoose.set('useCreateIndex', true);

// SCHEMA ------------------------------------------------------------------------------------
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    profilepic: String,
    password: String
});

const articleSchema = new mongoose.Schema({
    author: String,
    authorID: String,
    authorimg: String,
    article: String
});


// MODELS -----------------------------------------------------------------------------------
const Person = mongoose.model("user", userSchema);
const Article = mongoose.model("article", articleSchema);




passport.serializeUser(function(user, done) {
    done(null, user);
  });
  
passport.deserializeUser(function(user, done) {
    done(null, user);
  });


passport.use(new LocalStrategy( {usernameField: "email", passwordField: "password" }, (email, password, done) =>{
    
    Person.findOne( {email: email}).then((user =>{
        if(!user){
            return done(null, false, {msg: "Email or username is not correct"});
        }
        if(user){
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if(err)
                {  
                    return done(err);
                }
                if(!isMatch){
                    return done(null, false, { msg: "Password incorrect"} );
                }else{
                    return done(null, user);
                }
            });
        }
    })).catch((err) => {
        return done(err);
    });
}));

app.get("/signup", (req, res) => {
    res.render("signup", {errors: req.flash("errors")});
});

app.post("/signup", (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const password2 = req.body.password2;

// VALIDATION------------------------------------------------------------------
errorArray = [];

if(name.length <= 1){
    errorArray.push("Username is too short");
}
if(password !== password2){
    errorArray.push("Password didn't match")
}else{
    if(password.length < 6){
        errorArray.push("Password too short");
    }
}
// VALIDATON ENDS =------------------------------------------------
Person.findOne({email: email}).then((user) =>{
    if(user){
        errorArray.push("Email is already registered");
    }

    if(errorArray.length > 0){
        req.flash("errors", errorArray);
        res.redirect("/signup");
    }else if(errorArray.length === 0){
        bcrypt.hash(password, 10).then((hashed => {
            const newUser = new Person({
                name: name,
                email: email,
                profilepic: "uploads/images/def/userAvatar.png",
                password: hashed
            });
            newUser.save();
            req.flash("success",["You can now login"]);
            res.redirect("/login");
            })).catch((err) => {
                console.log(err);
            });
        }
    }); 
});



app.get("/login", (req, res) =>{
    
    res.render("login", {success: req.flash('success'), errors: req.flash('errors')})

});


app.post("/login", (req, res, next) =>{
    const email = req.body.email;
    const password = req.body.password;
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err) }
        if (!user) {
            req.flash("errors", ["wrong credentials"]);
            return res.redirect("/login");
        }else{
            req.logIn(user, (err) =>{
                if(err){return next(err)}
                return res.redirect("/");
            });
        }
      })(req, res, next);
});



app.get("/", (req, res) =>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        Article.find().then((result) =>{
            console.log(req.user._id);
            res.render("index", {user: req.user.name, userimg: req.user.profilepic, articles: result.reverse()})
        }).catch((err) =>{
            console.log(err);
        })
    }
})


app.get("/logout" , (req, res) =>{
    req.logOut();
    res.redirect("/");
})


// POSTING
app.post("/home/post", (req, res) => {
    if(req.isAuthenticated()){
        const author = req.user.name;
        const authorimg = req.user.profilepic;
        const article = req.body.article;

        if(author && article.length > 0){
        const art = new Article({
            author,
            authorID: req.user._id,
            authorimg: req.user.profilepic,
            article
        });
        art.save();
        res.redirect("/");

    }else{
        res.redirect("/");
    }
    }
})


app.get("/user/propic", (req, res) => {
    if(!req.isAuthenticated())
    {
        res.redirect("/");
    }else{
        res.render("upload");
    }
});

app.post('/user/propic', upload.single('picture'), async (req, res, next) => {
    imgPath = req.file.path.slice(7,req.file.path.length);
    const result = await Person.updateOne({ email: req.user.email }, { profilepic: imgPath });
    Article.updateMany( {authorID: req.user._id}, {authorimg: imgPath} ) });
    req.session.passport.user.profilepic = imgPath;
    res.redirect("/");
});



app.listen( process.env.PORT || 3000, () => {
    console.log("Server has been started on port 3000");
})