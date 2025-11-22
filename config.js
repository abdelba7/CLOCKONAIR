// config.js
module.exports = {
  tcpPort: 3500,              // pour l'Arduino extérieur
  httpPort: 3000,             // pour l'API HTTP (en localhost uniquement)
  authToken: "f02165728b8c53f2dfe31f5a16a6a133981e1e7c49a7e98ee08ef608aea4058f", // même que sur l'Arduino

  // config MR18 (à adapter quand tu connaîtras l'IP publique/privée utilisée)
  mr18: {
    enabled: false,           // on le laissera à true quand on sera prêts
    host: "192.168.2.50",     // IP de la console MR18 côté réseau de prod / extérieur
    port: 10024               // port OSC MR18 (comme dans ton Arduino)
  }
};
