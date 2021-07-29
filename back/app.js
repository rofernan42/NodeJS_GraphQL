const express = require('express');

const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const { graphqlHTTP } = require('express-graphql');
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const { customFormatErrorFn } = require('graphql');
const auth = require('./middleware/auth');
const { clearImage } = require('./util/file');

const app = express();

const MONGODB_URI = 'mongodb+srv://romain:LUJODAVfeltMTpKv@cluster0.ub4t7.mongodb.net/blog-graphQL?retryWrites=true&w=majority'

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images');
    },
    filename: (req, file, cb) => {
        const dateStr = new Date().toISOString().replace(/:/g, '-');
        cb(null, dateStr + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

// app.use(bodyParser.json()); // application/json - deprecated
app.use(express.json()); // application/json
app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // allow every domains
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(auth);

app.put('/post-image', (req, res, next) => {
    if (!req.isAuth) {
        throw new Error('Not authenticated.');
    }
    if (!req.file) {
        return res.status(200).json({ message: 'No file provided.' });
    }
    if (req.body.oldPath) {
        clearImage(req.body.oldPath);
    }
    return res.status(201).json({ message: 'File stored.', filePath: req.file.path.replace("\\", "/") });
});

app.use('/graphql', graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true, // permet d'aller sur localhost:8080/graphql et d'avoir une interface pour faire des tests
    customFormatErrorFn(err) {
        if (!err.originalError) { // originalError: erreurs speficiques qu'on a parametrees (ca ne concerne pas les erreurs de syntaxe etc...)
            return err;
        }
        const data = err.originalError.data;
        const message = err.message || 'An error occurred.';
        const code = err.originalError.code || 500;
        return { message: message, status: code, data: data };
    }
}));

// exemple pour creer un utilisateur dans la base de donnees avec graphiql:
// mutation {
//   createUser(userInput: {email: "romain@mail.com", name: "rom", password: "12345"}) {
//     _id
//     email
//   }
// }
// faire ctrl + entrée -> va afficher les données a droite (+ creer l'utilisateur dans la base de donnees) (s'il y a une erreur: va afficher les erreurs)

app.use((error, req, res, next) => {
    console.log(error);
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;
    res.status(status).json({ message: message, data: data });
});

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        app.listen(8080);
    })
    .catch(err => console.log(err));
