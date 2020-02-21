const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// const DATA_PATH= firebase.config().watched
const DATA_PATH = "Status/{uuid1}/{uuid2}";
const THIRTY_MINUTES = 60 * 30 * 1000;
const ONE_HOUR = 2 * THIRTY_MINUTES;
const THREE_MINUTES = 15 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

setInterval(async () => {
  const db = admin.database();
  const snap = await db.ref("Status/CCAC")
    .orderByKey()
    .limitToLast(1)
    .once("value");
  let timediff = Object.values(snap.val())[0].Time;
  if ((new Date() - new Date(timediff)) > THREE_MINUTES) {
    console.log("Power off in CCAC");
    //send cutoff data to firebase
    const key = (await db.ref("Cutoff/CCAC").push()).key;
    await db.ref("Cutoff/CCAC")
      .child(key)
      .set(snap.val());

    //set notification payload
    let msg = {
      data: {
        title: "cutoffTitle",
        key: timediff,
        date: timediff
      },
      topic: "cutoff"
    };
    //send notification
    return admin.database().ref("Flag/notif").once("value")
      .then(async (snap_1) => {
        if (snap_1.val() !== "sent") {
          return admin.messaging().send(msg)
            .then(response => {
              console.log(`Successfully sent notification data : `, response);
              //if notif sent update Flag/notif
              return db.ref("Flag")
                .child("notif")
                .set("sent");
              //return 0;
            })
            .catch(error => {
              console.log(`Error sending notification data : `, error);
            });
        }
        else
          return 0;
      })
      .catch(error_1 => {
        console.log(`Error getting flag data : `, error_1);
      });
  }
  else {
    //Power on in CCAC ADD notif flag
    console.log("Power on in CCAC");
    //if power back up update Flag/notif
    return db.ref("Flag")
      .child("notif")
      .set("not sent");
  }
}, THREE_MINUTES);

exports.nextLevel = functions.database
  .ref(DATA_PATH)
  .onCreate(async (snap, context) => {
    const uuid1 = context.params.uuid1;
    const uuid2 = context.params.uuid2;

    // Shifting of data from Status to Data
    let currTime = snap.val().Time;
    if (!currTime) {
      currTime = Date.now();
    }
    //console.log(currTime);

    return await admin
      .database()
      .ref(`Status/${uuid1}`)
      .once("value")
      .then(async snap => {
        // console.log(snap.val());
        const toWait = [];
        snap.forEach(childSnap => {
          // console.log(childSnap.val());
          if (uuid2 !== childSnap.key) {
            //Send nodes to Data only if time difference is >= 30mins
            if (
              Math.abs(
                new Date(currTime) - new Date(childSnap.val().Time) >=
                  THIRTY_MINUTES
              )
            ) {
              //push data to Data from Status
              toWait.push(
                admin
                  .database()
                  .ref("Data/")
                  .child(uuid1)
                  .child(childSnap.key)
                  .set(childSnap.val())
                  .then(async () => {
                    //Getting Score
                    let CS = childSnap.val().ChargingState;
                    if (CS) {
                      const user = await admin
                        .database()
                        .ref(`Users/${uuid1}`)
                        .once("value")
                        .then(async snap => snap.val());

                      if (user.Score) {
                        user.Score++;
                      } else {
                        user.Score = 1;
                      }

                      await admin
                        .database()
                        .ref(`Users/${uuid1}`)
                        .set(user)
                        .catch(err => console.log(err.toString()))
                        .then(() => console.log(`${uuid1} ${user.Score}`));
                    } else {
                      console.log("Charging State: " + CS + " " + uuid2);
                    }

                    //remove old data
                    return childSnap.ref.remove();
                  })
              );
              //console.log(Math.abs((new Date(currTime)) - (new Date(childSnap.val().Time))));
            }
          }
        });
        console.log("UUID data moved: " +uuid1);
        //console.log(currTime);
        return await Promise.all(toWait);
      });
  });
