const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// const DATA_PATH= firebase.config().watched
const DATA_PATH = 'Status/{uuid1}/{uuid2}';
const THIRTY_MINUTES = 60 * 30 * 1000;
const ONE_HOUR = 2 * THIRTY_MINUTES;

exports.nextLevel = functions.database.ref(DATA_PATH).onCreate(async (snap, context) => {
    const uuid1 = context.params.uuid1;
    const uuid2 = context.params.uuid2;

    // Shifting of data from Status to Data
    let currTime = snap.val().Time;
    if (!currTime) {
        currTime = Date.now();
    }
    //console.log(currTime);

    return await admin.database().ref(`Status/${uuid1}`).once('value').then(async (snap) => {
        // console.log(snap.val());
        const toWait = [];
        snap.forEach((childSnap) => {
            // console.log(childSnap.val());
            if (uuid2 !== childSnap.key) {
                //Send nodes to Data only if time difference is >= 30mins
                if (Math.abs((new Date(currTime) - (new Date(childSnap.val().Time))) >= THIRTY_MINUTES)) {

                    //push data to Data from Status
                    toWait.push(admin.database().ref('Data/').child(uuid1).child(childSnap.key)
                        .set(childSnap.val()).then(async () => {

                            //Getting Score
                            let CS = childSnap.val().ChargingState;
                            if (CS) {
                                const user = await admin.database().ref(`Users/${uuid1}`).once('value')
                                    .then(async snap => snap.val());

                                if (user.Score) {
                                    user.Score++;
                                } else {
                                    user.Score = 1;
                                }

                                await admin.database().ref(`Users/${uuid1}`).set(user)
                                    .catch((err) => console.log(err.toString()))
                                    .then(() => console.log(`${uuid1} ${user.Score}`));
                            } else {
                                console.log("CS is " + CS + " " + uuid2);
                            }

                            //remove old data
                            return childSnap.ref.remove();
                        }));
                    //console.log(Math.abs((new Date(currTime)) - (new Date(childSnap.val().Time))));

                }
            }
        });
        console.log(uuid1);
        console.log(currTime);
        return await Promise.all(toWait);
    });
});
