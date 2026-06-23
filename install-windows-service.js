var Service = require("node-windows").Service;

// Create a new service object
var svc = new Service({
  name: "722-parser-service",
  description: "JSON-OSC parser for 722-LX",
  script: "C:\\722-parser\\722-LX-JSON-main\\server.js", // <-- your app entry point, NOT this installer
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on("install", function () {
  console.log("Install complete.");
  svc.start();
});

svc.on("alreadyinstalled", function () {
  console.log("Service is already installed.");
});

svc.install();
