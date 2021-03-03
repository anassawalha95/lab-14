'use strict'
let c = console
const express = require('express')
const superAgent = require('superagent')
const pg = require('pg');
require('dotenv').config();
const expresslayout = require("express-ejs-layouts")
const methodOverride = require('method-override');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

//const client = new pg.Client(process.env.DATABASE_URL)
const PORT = process.env.PORT || 3000
const app = express();

app.set('view engine', 'ejs')
app.use(express.static('./public'))
app.use(express.urlencoded({ extended: true }))
app.use(expresslayout)
app.use(methodOverride('method'));



app.get('/', home);
app.get('/searches/new', newSearch);
app.post('/searches', searchForBooks);
app.post('/savebook', saveBook);
app.get('/books/show', showAllBooks);
app.get('/books/detail/:id', showBookDetails);
app.post('/books/edit/:id', editBook);
app.put('/updateBook/:id', updateBook)
app.delete('/deleteBook/:id', deleteBook)
app.get('*', unknownRoute);
app.use(errorHandler)



function Book(book) {
    this.img_url = validateData(book.volumeInfo.imageLinks ? book.volumeInfo.imageLinks.thumbnail : "", 'https://i.imgur.com/J5LVHEL.jpg');
    this.title = validateData(book.volumeInfo.title, 'Unknow Title');
    this.author = validateData(book.volumeInfo.authors, 'Unknow Authors')
    this.description = validateData(book.volumeInfo.description, 'No Description Available')
    this.isbn = book.volumeInfo.industryIdentifiers != null ? `ISBN_13${book.volumeInfo.industryIdentifiers[0].identifier}` : "No ISBN";
    this.book_shelf = validateData(book.volumeInfo.categories, "Unknow Category");
}

function validateData(data, alternativeValue) {
    return data != null ? data : alternativeValue;
}

//Home Route
function home(req, res, next) {

    let SQL = "SELECT * FROM book;";
    client.query(SQL)
        .then((data) => {
            //res.json({ allBooks: data.rows, numberOfBooks: data.rowCount });
            return res.render('pages/index', { allBooks: data.rows, numberOfBooks: data.rowCount });
        }).catch(next);

}

// Search Render
function newSearch(req, res, next) {
    return res.render("pages/searches/new")
}

// Search Handler
function searchForBooks(req, res, next) {
    let searchBy = req.body.bookTitleOrAuthor;
    let filterBy = ''

    if (req.body.filterBy != null)
        filterBy = (req.body.filterBy == "Title") ? `intitle:${searchBy}` : `inauthor:${searchBy}`
    else
        filterBy = searchBy


    let url = `https://www.googleapis.com/books/v1/volumes?q=${filterBy}`

    superAgent.get(url)
        .then(data => {
            let books = data.body.items.map(val => {
                let book = new Book(val);
                return book;
            })
            return res.render('pages/searches/show', { allBooks: books });

        }).catch(next);
}


// save a book Handler

function saveBook(req, res, next) {
    let { img_url, title, author, description, isbn, book_shelf } = req.body;
    img_url = validateData(img_url, 'https://i.imgur.com/J5LVHEL.jpg')
    title = validateData(title, 'Unknow Title')
    author = validateData(author, 'Unknow Authors')
    description = validateData(description, 'No Description Available')
    isbn = validateData(isbn, "No ISBN")
    book_shelf = validateData(book_shelf, "Unknow Category")
    let SQL = `INSERT INTO book(img_url,title,author,description,isbn,book_shelf) VALUES ($1,$2,$3,$4,$5,$6)  returning id  ;`
    let safe = [img_url, title, author, description, isbn, book_shelf];

    client.query(SQL, safe)
        .then((result) => {
            return res.redirect(`/books/detail/${result.rows[0].id}`);
        }).catch(next);
}


// show a book details Handler
function showBookDetails(req, res, next) {

    let SQL = `SELECT * FROM book WHERE id = $1;`;
    let safe = [+req.params.id];

    client.query(SQL, safe)
        .then(result => {
            res.render('pages/books/detail', { Book: result.rows });
        }).catch(next);


}
// show all books Handler
function showAllBooks(req, res, next) {
    let SQL = "SELECT * FROM book;";
    client.query(SQL)
        .then((data) => {

            return res.render('pages/books/show', { allBooks: data.rows, numberOfBooks: data.rowCount });
        }).catch(next);
}

function editBook(req, res, next) {

    let SQL = `SELECT * FROM book WHERE id = $1;`;
    let safe = [+req.params.id];
    client.query(SQL, safe)
        .then(result => {
            return res.render("pages/books/edit", { Book: result.rows })
        }).catch(next);

}

function updateBook(req, res, next) {

    let { img_url, title, author, description, isbn, book_shelf } = req.body;
    let SQL = `UPDATE book SET img_url=$1,title=$2,author=$3,description=$4,isbn=$5,book_shelf=$6 WHERE id =$7 returning id`
    let id = req.params.id;
    let safe = [img_url, title, author, description, isbn, book_shelf, id];
    client.query(SQL, safe)
        .then(() => {

            return res.redirect(`/books/detail/${id}`);
        }).catch(next);
}

function deleteBook(req, res) {
    let SQL = `DELETE FROM book WHERE id=$1;`;
    let safe = [req.params.id];
    client.query(SQL, safe)
        .then(() => {
            res.redirect('/');
        });

};

function unknownRoute(req, res, next) {
    res.render('/pages/error')
}
function errorHandler(error, req, res, next) {
    res.render('pages/error');


}


client.connect()
    .then(() => {
        app.listen(PORT, () => {
            c.log(`http://localhost:${PORT}/`)
        })
    });
