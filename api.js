import pkg from 'express';

const app = pkg();
const port = 3000;

import { MongoClient } from 'mongodb';
const mongoClient = new MongoClient('mongodb://localhost:27017/');
await mongoClient.connect();
const dbo = mongoClient.db('thebroker');

const step = 604800; // 7 days in seconds
app.get('/', (req, res) => {
    res.send('Hello World!')
  })
app.get("/stats",async (req,res) => {
    // Get completed contracts from database
    const contracts = await dbo.collection("contracts").find({'date': {$gte : 1651615200 }, 'state' : {$eq : 'Abgeschlossen'}  }).toArray();

    const epochNow = (new Date().getTime() / 1000);
    let weeklyGold = []; // Will contain cumulative amount of gold earned per 7 day interval (Starting now in oder of most current -> oldest interval)
    let weeklyContract = [];

    // Iterate over all contracts and populate weeklyGold/weeklyContract array
    contracts.forEach(contract => {
        
        const weekIndex = Math.trunc((epochNow - contract.date)/step); // Index increases with contract age
    
        if(!weeklyGold[weekIndex]) weeklyGold[weekIndex] = 0;
        weeklyGold[weekIndex] = weeklyGold[weekIndex] + contract.gold;
    
        if(!weeklyContract[weekIndex]) weeklyContract[weekIndex] = 0;
        weeklyContract[weekIndex] = weeklyContract[weekIndex] + 1;

    });

    // Set empty arrray values to 0
    weeklyGold = Array.from(weeklyGold, item => item || 0);
    weeklyContract = Array.from(weeklyContract, item => item || 0); 

    
    switch (req.query.type) {
        case 'overview':
            res.json({ 
                goldCount: weeklyGold.reduce((pv, cv) => pv + cv, 0), 
                contractCount: contracts.length,
             });
            break;
        case 'goldData':
            res.json({labels: getDateArray(weeklyGold.length).reverse(), values: weeklyGold.reverse() });
            break;
        case 'contractData':
            res.json({labels: getDateArray(weeklyContract.length).reverse(), values: weeklyContract.reverse() });
            break;
        case 'memberData':
            res.json({})
            break;
        default:
            res.json({});
            break;
    }

})

app.listen(port, () => console.log(`Example app listening on port ${port}!`));



function getDateArray(weeks) {
    const epochNow = (new Date().getTime() / 1000);
    let temp = [];
    for (let i = 0; i < weeks; i++) {
        temp[i] = new Date((epochNow * 1000) - step * i * 1000).toLocaleDateString('de-DE', {month:"short", day:"numeric"})
    }
    return temp;
}