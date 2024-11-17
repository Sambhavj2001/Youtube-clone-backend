import dotenv from "dotenv";
import connectDB from "./db/db.js";

dotenv.config({
    path:'./env'
})

connectDB()


/*
// this is not the good approch b/c it pollutes the index.js file so we don't use this mostly

import express from "express";
const app = express();
(async ()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (error)=>{
            console.log("Error ", error);
            throw error
        })
        app.listen(process.env.PORT,()=>{
            console.log(`App is listing on Port: ${process.env.PORT}`);
            
        })
    } catch (error) {
        console.error("Error: ", error);
        throw err
    }
})()

*/