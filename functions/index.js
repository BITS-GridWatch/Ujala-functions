const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// const DATA_PATH= firebase.config().watched
const DATA_PATH= 'Status/{uuid1}/{uuid2}';
const THIRTY_MINUTES = 60*30*1000;
const ONE_HOUR = 2*THIRTY_MINUTES;

// async function pushData(uuid1,childSnap) {
//     console.log("HELPer called");
//
//     return await admin.database().ref('Data/').child(uuid1).child(childSnap.key).set(childSnap.val());
//
// }


exports.nextLevel = functions.database.ref(DATA_PATH).onCreate(async (snap,context) => {
    let currTime = snap.val().Time;
    if(!currTime){
        currTime=Date.now();
    }
    //console.log(currTime);

    const uuid1 = context.params.uuid1;
    const uuid2 = context.params.uuid2;
    // console.log(time);
    // let i = 2;
    return await admin.database().ref(`Status/${uuid1}`).once('value').then(async (snap) => {
        // console.log(snap.val());
        const toWait = [];
        snap.forEach((childSnap) => {
            // console.log(childSnap.val());
            if(uuid2 !== childSnap.key) {
                if(Math.abs((new Date(currTime) - (new Date(childSnap.val().Time))) >= THIRTY_MINUTES)) {
                    toWait.push(admin.database().ref('Data/').child(uuid1).child(childSnap.key)
                        .set(childSnap.val()).then(() => {
                            return childSnap.ref.remove();
                        }));
                    // toDelete.push(childSnap.ref().remove());
                    //console.log(Math.abs((new Date(currTime)) - (new Date(childSnap.val().Time))));

                }
            }
            // return true;
        });
        // await Promise.all(toWait);
        console.log(uuid1);
        console.log(currTime);
        return await Promise.all(toWait);
    });
});


