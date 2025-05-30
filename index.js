const express = require('express');
const app = express();
const PORT = 9000;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
app.use(express.json());
const multer = require('multer');
const path = require('path');
const JWT_SECRET = 'your_jwt_secret';  // use env var in real apps
const cors = require('cors');


// Use CORS with default settings (allows all origins)
app.use(cors());
// Import database connection
const db = require('./db'); // make sure the path is correct

app.get('/', (req, res) => {
  res.send('Hello, Express is working!');
});


// Example route to test DB query
app.get('/test-db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()'); // simple test query
    res.json({ success: true, time: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'DB error' });
  }
});



// register the user
// Setup storage engine (optional: save files to disk with original name)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    // Example: user-aadhaar + original extension
    const ext = path.extname(file.originalname);
    cb(null, req.body.aadhaar + ext);
  }
});

const upload = multer({ storage });

app.post('/register', upload.single('photo'), async (req, res) => {
  const { name, email, aadhaar, phone, password } = req.body;
  const photo = req.file ? req.file.filename : null;  // filename saved on server

  if (!name || !email || !aadhaar || !password) {
    return res.status(400).json({ message: 'Please fill in all required fields.' });
  }

  try {
    const existingUser = await db.query(
      'SELECT * FROM userinfo WHERE email = $1 OR aadhaar = $2',
      [email, aadhaar]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists with this email or Aadhaar' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO userinfo (name, email, aadhaar, phone, photo, password)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [name, email, aadhaar, phone, photo, hashedPassword]
    );

    res.status(201).json({ message: 'User registered successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//login user
app.post('/login', async (req, res) => {
  const { aadhaar, password } = req.body;

  if (!aadhaar || !password) {
    return res.status(400).json({ message: 'Please provide Aadhaar and password' });
  }

  try {
    const result = await db.query('SELECT * FROM userinfo WHERE aadhaar = $1', [aadhaar]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid Aadhaar or password' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid Aadhaar or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login successful', token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});





// add greviance 



app.post('/grievance', upload.single('photo'), async (req, res) => {
  const { areaName, address, grievanceType, description } = req.body;
  const photo = req.file ? req.file.originalname : null;
  // Use req.file.buffer if you want to store binary or convert to base64

  if (!areaName || !address || !grievanceType) {
    return res.status(400).json({ message: 'Please provide all required fields' });
  }

  try {
    const insertQuery = `
      INSERT INTO grievances (area_name, address, grievance_type, photo, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [areaName, address, grievanceType, photo, description];

    const result = await db.query(insertQuery, values);

    res.status(201).json({
      message: 'Grievance submitted successfully',
      data: result.rows[0],
    });

  } catch (error) {
    console.error('Error inserting grievance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});




//get all greviance 
app.get('/grievances', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM grievances ORDER BY id DESC');

    res.status(200).json({
      message: 'Grievances fetched successfully',
      data: result.rows,
    });

  } catch (error) {
    console.error('Error fetching grievances:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});




// DELETE grievance by ID
app.delete('/grievances/:id', async (req, res) => {
  const grievanceId = parseInt(req.params.id, 10);

  try {
    // Check if grievance with the given ID exists
    const check = await db.query('SELECT * FROM grievances WHERE id = $1', [grievanceId]);

    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Grievance not found' });
    }

    // Delete the grievance
    await db.query('DELETE FROM grievances WHERE id = $1', [grievanceId]);

    res.status(200).json({ message: 'Grievance deleted successfully' });
  } catch (error) {
    console.error('Error deleting grievance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// get all users data 
app.get('/users', async (req, res) => {
  try {
   const result = await db.query(
  'SELECT id, name, email, aadhaar, phone, photo FROM userinfo ORDER BY id DESC');

    res.status(200).json({
      message: 'Users fetched successfully',
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});




// add document request
app.post('/documents', async (req, res) => {
  const { documentType, documentName, timeline, email } = req.body;

  if (!documentType || !documentName || !email) {
    return res.status(400).json({ message: 'Please provide documentType, documentName, and email' });
  }

  try {
    const query = `
      INSERT INTO documents (document_type, document_name, timeline, email)
      VALUES ($1, $2, $3, $4) RETURNING *;
    `;

    const values = [documentType, documentName, timeline || null, email];

    const result = await db.query(query, values);

    res.status(201).json({ message: 'Document saved', document: result.rows[0] });

  } catch (error) {
    console.error('Error inserting document:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// get user requets for documents 
app.get('/documents', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM documents ORDER BY insert_date DESC');

    res.json({ documents: result.rows });

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// DELETE document by ID
app.delete('/documents/:id', async (req, res) => {
  const documentId = parseInt(req.params.id, 10);

  try {
    // Check if document with the given ID exists
    const check = await db.query('SELECT * FROM documents WHERE id = $1', [documentId]);

    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete the document
    await db.query('DELETE FROM documents WHERE id = $1', [documentId]);

    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// POST /documents - Save a new document
app.post('/userdocuments', async (req, res) => {
  const { username, useremail, document_type, document_name } = req.body;

  if (!username || !useremail || !document_type || !document_name) {
    return res.status(400).json({ message: 'Please fill all required fields.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO user_documents (username, useremail, document_type, document_name) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [username, useremail, document_type, document_name]
    );

    res.status(201).json({ message: 'Document saved successfully', document: result.rows[0] });
  } catch (error) {
    console.error('Error saving document:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// GET /documents - Get all documents
app.get('/userdocuments', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM user_documents ORDER BY insert_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
