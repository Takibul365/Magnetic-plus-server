const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

const port = process.env.PORT || 5000;

//middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@magneticplus.somyfzj.mongodb.net/?retryWrites=true&w=majority&appName=MagneticPlus`;

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

        // const productCollection = client.db('MERN').collection('products')

        const addToCartCollection = client.db('MERN').collection('carts')
        const userCollection = client.db('MERN').collection('users')
        const itemCollection = client.db('MERN').collection('items')
        const orderCollection = client.db('MERN').collection('orders')
        const categoriesCollection = client.db('MERN').collection('categories')
        const deliveredCollection = client.db('MERN').collection('delivered')
        const bestCollection = client.db('MERN').collection('best')
        const topCollection = client.db('MERN').collection('top')
        const popularCollection = client.db('MERN').collection('popular')


        //Jwt related Api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10d' });
            res.send({ token })
        })

        //Varify token midelware
        const varifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1]

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }
        //use varify admin after varify token
        const varifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }



        // app.get('/products', async (req, res) => {
        //     const data = productCollection.find();
        //     const result = await data.toArray()
        //     res.send(result)
        // })
        ////Get categories
        app.get('/categories', async (req, res) => {
            const result = await categoriesCollection.find().toArray()
            res.send(result)
        })
        ////get items

        app.get('/items', async (req, res) => {
            const result = await itemCollection.find().toArray()
            res.send(result)
        })

        /// Get single Item
        app.get('/item/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await itemCollection.findOne(query);
            res.send(result)
        })

        app.post('/items', varifyToken, varifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await itemCollection.insertOne(item);
            res.send(result)
        })
        ///Item delete
        app.delete('/items/:id', varifyToken, varifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await itemCollection.deleteOne(query);
            res.send(result)
        })
        //Item Patch
        app.patch('/item/:id', varifyToken, varifyAdmin, async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name: item.name,
                    price: item.price,
                    desc: item.desc,
                    categories: item.categories,
                    img: item.img
                }
            }
            const result = await itemCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })




        app.get('/addtocart', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const allItem = await itemCollection.find().toArray()
            const result = await addToCartCollection.find(query).toArray()
            // console.log(result);
            let cartItems = [];
            const resultmap = result.map(i => {
                let cartItem = allItem.find(a => a._id == i.ItemId)
                let modifiedCartItem = {
                    _id: i._id,
                    name: cartItem.name,
                    img: cartItem.img,
                    price: cartItem.price,
                    quantity: i.quantity || 1,
                }
                cartItems.push(modifiedCartItem)
            })
            // console.log(cartItems);

            res.send(cartItems)
        })


        //Add to cart duplicate order handle update and post

        app.post('/addtocart', async (req, res) => {
            const item = req.body;


            const personEmail = item.email;
            const query = { email: personEmail };
            const personOrders = await addToCartCollection.find(query).toArray()



            if (personOrders.length == 0) {
                const result = await addToCartCollection.insertOne(item);

                res.send(result)
            }
            else {

                const findDuplicateOrder = personOrders.find(order => order.ItemId === item.ItemId)

                if (findDuplicateOrder == undefined) {
                    const result = await addToCartCollection.insertOne(item);

                    res.send(result)

                } else {
                    // console.log(findDuplicateOrder == undefined);

                    const id = findDuplicateOrder._id

                    const filter = { _id: new ObjectId(id) }

                    if (findDuplicateOrder.quantity) {
                        let quantity = findDuplicateOrder.quantity + item.quantity;

                        const updatedDoc = {
                            $set: {
                                quantity: quantity
                            }
                        }
                        const result = await addToCartCollection.updateOne(filter, updatedDoc)
                        res.send(result)

                    }
                    else {
                        let quantity = 2;

                        const updatedDoc = {
                            $set: {
                                quantity: quantity
                            }
                        }
                        const result = await addToCartCollection.updateOne(filter, updatedDoc)
                        res.send(result)

                    }
                }
            }
        })





        // Delete from add to cart add to cart
        app.delete('/addtocart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await addToCartCollection.deleteOne(query);
            res.send(result)
        })

        //user related api
        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User Alrady Exists", InsertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result);
        })
        //Users get


        app.get('/users', varifyToken, async (req, res) => {

            const result = await userCollection.find().toArray();
            res.send(result)
        })
        //user delete

        app.delete('/users/:id', varifyToken, varifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result)
        })

        //get admin check
        app.get('/users/admin/:email', varifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';

            }
            res.send({ admin });
        })

        //user admin role implement
        app.patch('/users/admin/:id', varifyToken, varifyAdmin, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })




        // Order Post 
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result)
        })
        //Order Get user
        app.get('/orders', varifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await orderCollection.find(query).toArray()
            res.send(user);
        })
        ///User Order History

        app.get('/userOrderHistory', varifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await deliveredCollection.find(query).toArray()
            res.send(user);
        })




        //Order get admin
        app.get('/allOrders', varifyToken, varifyAdmin, async (req, res) => {

            const result = await orderCollection.find().toArray();
            res.send(result)
        })

        //Admin Status change Orders

        app.patch('/orders/admin/:id', varifyToken, varifyAdmin, async (req, res) => {

            const id = req.params.id;
            const status = req.query.status;
            const filter = { _id: new ObjectId(id) };

            const updatedDoc = {
                $set: {
                    status: status
                }
            }
            const result = await orderCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })


        //Admin Delete  Orders

        app.delete('/orders/admin/:id', varifyToken, varifyAdmin, async (req, res) => {
            const id = req.params.id

            const allOrder = await orderCollection.find().toArray()

            const finalOrder = allOrder.find(order => order._id == id);


            const query = { _id: new ObjectId(finalOrder._id) }
            const preResult = await orderCollection.deleteOne(query);
            // console.log(id, finalOrder);
            const result = await deliveredCollection.insertOne(finalOrder);
            res.send({ result, preResult })
        })


        ////Admin get order
        app.get('/orderHistory', varifyToken, varifyAdmin, async (req, res) => {
            const result = await deliveredCollection.find().toArray()
            res.send(result)
        })

        /////Best Products

        app.post('/bestProducts', async (req, res) => {
            const productId = req.body;
            await bestCollection.deleteMany({});
            const data = { data: productId }
            const result = await bestCollection.insertOne(data)
            res.send(result)

        })

        app.get('/bestProducts', async (req, res) => {
            const result = await bestCollection.find().toArray()
            res.send(result)
        })

        /////popular Products

        app.post('/popularProducts', async (req, res) => {
            const productId = req.body;
            await popularCollection.deleteMany({});
            const data = { data: productId }
            const result = await popularCollection.insertOne(data)
            res.send(result)

        })

        app.get('/popularProducts', async (req, res) => {
            const result = await popularCollection.find().toArray()
            res.send(result)
        })
        /////Top selling Products

        app.post('/topProducts', async (req, res) => {
            const productId = req.body;
            await topCollection.deleteMany({});
            const data = { data: productId }
            const result = await topCollection.insertOne(data)
            res.send(result)
        })

        app.get('/topProducts', async (req, res) => {
            const result = await topCollection.find().toArray()
            res.send(result)
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
    res.send('Magnetic-plus is running')
})

app.listen(port, () => {

    console.log(`Magnetic-plus server is running on port ${port}`);

})