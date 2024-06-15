const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
app.use(flash());
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/blogDB', { useNewUrlParser: true, useUnifiedTopology: true });

// Schema and Models
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String
});

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    comments: [{
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        content: String
    }]
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Helper function to check if user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/posts', (req, res) => {
    Post.find({})
        .populate('author')
        .exec((err, posts) => {
            if (!err) {
                res.json(posts);
            } else {
                res.status(500).send(err);
            }
        });
});

app.get('/post/:id', (req, res) => {
    Post.findById(req.params.id)
        .populate('author')
        .populate('comments.author')
        .exec((err, post) => {
            if (!err) {
                res.json(post);
            } else {
                res.status(500).send(err);
            }
        });
});

app.get('/new', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'new.html'));
});

app.post('/posts', ensureAuthenticated, (req, res) => {
    const newPost = new Post({
        title: req.body.title,
        content: req.body.content,
        author: req.user._id
    });

    newPost.save((err) => {
        if (err) {
            res.status(500).send('Error saving post.');
        } else {
            res.redirect('/');
        }
    });
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    const newUser = new User({ username, email, password });

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
            if (err) throw err;
            newUser.password = hash;
            newUser.save((err) => {
                if (err) {
                    req.flash('error_msg', 'Error registering user.');
                    res.redirect('/register');
                } else {
                    req.flash('success_msg', 'You are now registered and can log in.');
                    res.redirect('/login');
                }
            });
        });
    });
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res, next) => {
    const { username, password } = req.body;

    User.findOne({ username: username }, (err, user) => {
        if (err) throw err;
        if (!user) {
            req.flash('error_msg', 'No user found.');
            res.redirect('/login');
        } else {
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) throw err;
                if (isMatch) {
                    req.session.user = user;
                    res.redirect('/');
                } else {
                    req.flash('error_msg', 'Password incorrect.');
                    res.redirect('/login');
                }
            });
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/profile', ensureAuthenticated, (req, res) => {
    User.findById(req.user._id)
        .populate('posts')
        .exec((err, user) => {
            if (!err) {
                res.json(user);
            } else {
                res.status(500).send(err);
            }
        });
});

app.post('/post/:id/comments', ensureAuthenticated, (req, res) => {
    Post.findById(req.params.id, (err, post) => {
        if (!err) {
            post.comments.push({
                author: req.user._id,
                content: req.body.content
            });

            post.save((err) => {
                if (!err) {
                    res.redirect(`/post/${req.params.id}`);
                } else {
                    res.status(500).send('Error saving comment.');
                }
            });
        } else {
            res.status(500).send('Error finding post.');
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
