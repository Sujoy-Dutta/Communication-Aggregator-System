import express from "express";

const app = express();
app.use(express.json());

app.post("/logs", (req, res) => {
    console.log("Received log:", req.body);
    res.status(201).json({ status: "ok"})
});
app.listen(3004, ()=>{
    console.log("logging service running on http://localhost:3004");
})
