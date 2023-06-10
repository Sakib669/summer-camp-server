const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

app.use(cors());
app.use(express.json());



const verifyJWT = async (req, res, next) => {
  const authorization = await req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access by verifyJWT1' });
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access by verifyJWT' });
    }
    req.decoded = decoded;
    next();
  })
}


const uri = "mongodb+srv://summerCapmDB:IoZ1KJ0qPsc1QXUl@cluster0.wdjom0q.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const usersCollection = client.db('summerCapmDB').collection('users');
    const classesCollection = client.db('summerCapmDB').collection('classes');
    const paymentsCollection = client.db('summerCapmDB').collection('payments');
    const classesCartCollection = client.db('summerCapmDB').collection('classesCart');

    const verifyStudent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user.role !== 'student') {
        return res.status(403).send({ error: true, message: 'forbidden message by student' });
      }
      next();
    }


    const verifyInstructor = async (req, res, next) => {
      const email = await req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message by student' });
      }
      next();
    }


    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message by student' });
      }
      next();
    }

    // users and jwt api
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };

      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result);
    })

    // student api
    app.get('/user/student/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const data = await classesCartCollection.find(query).toArray();
      if (data.length > 0) {
        res.send(data);
      }
    })

    // classes api
    app.get('/classes', async (req, res) => {
      const result = await classesCollection.find({ status: { $eq: 'approved' } }).toArray();
      res.send(result);
    })

    // classes Cart api
    app.post('/classes-cart', async (req, res) => {
      const data = req.body;
      const result = await classesCartCollection.insertOne(data);
      res.send(result);
    })

    app.get('/classes-cart', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/classes-cart/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCartCollection.deleteOne(query);
      res.send(result);
    })

    // instructors api
    app.get('/users/instructor/:email', verifyJWT, verifyInstructor, async (req, res) => {
      res.send({ role: 'instructor' });
    })

    app.post('/classes', async (req, res) => {
      const data = req.body;
      const result = await classesCollection.insertOne(data);
      res.send(result);
    })

    app.get('/classes-cart/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCartCollection.findOne(query);
      res.send(result);
    })

    // admin api
    app.get('/users/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      res.send({ role: 'admin' });
    })

    app.get('/all-users-data', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.patch('/all-users-data/', async (req, res) => {
      const role = req.query.role;
      const email = req.query.email;
      const filter = { email: email };
      const updateDoc = {
        $set: {
          role: role
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })


    app.get('/all-classes-data', verifyJWT, verifyAdmin , async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    })

    app.patch('/all-classes-data', async (req, res) => {
      const feedback = req.query.feedback;
      const status = req.query.status;
      const id = req.query.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback,
          status: status
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      return res.send(result);
    })









    // payment api
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.get('/payment-details', verifyJWT, async (req, res) => {
      const result = await paymentsCollection.find().toArray();
      res.send(result);
    })

    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);
      const query = { _id: new ObjectId(payment._id) };
      const deleteResult = await classesCartCollection.deleteOne(query);
      res.send({ insertResult, deleteResult });
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Summer Camp is running!')
})

app.listen(port, () => {
  console.log(`summer camp listening on port ${port}`)
})