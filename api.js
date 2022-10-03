import * as fs from 'fs';
import * as https from 'https';
import pkg from 'express';
import { MongoClient } from 'mongodb';

var options = {
    key: fs.readFileSync('/home/ubuntu/.ssl/privkey.pem', 'utf8'),
    cert: fs.readFileSync('/home/ubuntu/.ssl/cert.pem', 'utf8'),
};
const app = pkg();
const port = 3002;


const mongoClient = new MongoClient('mongodb://localhost:27017/');
await mongoClient.connect();
const dbo = mongoClient.db('thebroker');

const step = 604800; // 7 days in seconds

app.get("/api",async (req,res) => {
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

    // Member join rate
    let members = await dbo.collection('members').find({}).toArray();
    
    members = members.sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
 
    let memberJoinTimestampArray = [];
    members.forEach(member => {
        memberJoinTimestampArray.push(new Date(member.joinedTimestamp).toLocaleDateString('de-DE', {year: '2-digit', month: 'short'}));
    });
    

    switch (req.query.type) {
        case 'overview':
            res.json({ 
                goldCount: weeklyGold.reduce((pv, cv) => pv + cv, 0), 
                contractCount: contracts.length,
                memberCount: members.length
             });
            break;
        case 'goldData':
            res.json({labels: getWeekLabelsArray(weeklyGold.length).reverse(), values: weeklyGold.reverse() });
            break;
        case 'contractData':
            res.json({labels: getWeekLabelsArray(weeklyContract.length).reverse(), values: weeklyContract.reverse() });
            break;
        case 'memberData':
            let labelArray = getMonthLabelsArray(members[0].joinedTimestamp);
            let valueArray = getUserJoinValues(labelArray, memberJoinTimestampArray);
            const cumulativeSum = (sum => value => sum += value)(0);

            res.json({labels: ['', ...labelArray], values: [0, ...valueArray.map(cumulativeSum)]});
            break;
        default:
            res.json({});
            break;
    }

})

https.createServer(options, app).listen(port, function(){
    console.log("Express server listening on port " + port);
  });


function getWeekLabelsArray(weeks) {
    const epochNow = (new Date().getTime() / 1000);
    let temp = [];
    for (let i = 0; i < weeks; i++) {
        temp[i] = new Date((epochNow * 1000) - step * i * 1000).toLocaleDateString('de-DE', {month:"short", day:"numeric"})
    }
    return temp;
}

function getMonthLabelsArray(firstUserJoinedTimestamp) {
    const epochNow = (new Date().getTime() / 1000);
    let temp = [];

    let i = 0;
    while (((epochNow * 1000) - step * i * 1000) > firstUserJoinedTimestamp) {
        let month = new Date((epochNow * 1000) - step * i * 1000).toLocaleDateString('de-DE', {year: '2-digit', month: 'short'})
        if(!temp.includes(month)) temp.push(month) 
        i++;      
    }
    return temp.reverse();
}

function getUserJoinValues(labelArray, memberJoinTimestampArray) {
    let temp = []
    for (let i = 0; i < labelArray.length; i++) {
        temp[i] = memberJoinTimestampArray.filter(x => x == labelArray[i]).length;
    }
    return temp;
}