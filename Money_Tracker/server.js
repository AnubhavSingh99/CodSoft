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
mongoose.connect('mongodb://localhost:27017/moneyTrackerDB', { useNewUrlParser: true, useUnifiedTopology: true });

// Schema and Models
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String
});

const transactionSchema = new mongoose.Schema({
    type: String,
    amount: Number,
    description: String,
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

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
                    res.redirect('/dashboard');
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

app.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/transactions', ensureAuthenticated, (req, res) => {
    const { type, amount, description } = req.body;
    const newTransaction = new Transaction({
        type,
        amount,
        description,
        user: req.user._id
    });

    newTransaction.save((err) => {
        if (err) {
            res.status(500).send('Error saving transaction.');
        } else {
            res.redirect('/dashboard');
        }
    });
});

app.get('/transactions', ensureAuthenticated, (req, res) => {
    Transaction.find({ user: req.user._id })
        .sort({ date: -1 })
        .exec((err, transactions) => {
            if (!err) {
                res.json(transactions);
            } else {
                res.status(500).send(err);
            }
        });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
