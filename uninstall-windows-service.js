var Service = require("node-windows").Service;

// Must match the SAME name + script used at install time
var svc = new Service({
  name: "722-parser-service",
  description: "JSON-OSC parser for 722-LX",
  script: "C:\\722-parser\\722-LX-JSON-main\\server.js", // <-- your app entry point, NOT this installer
});

// Listen for the "uninstall" event so we know when it's done.
svc.on("uninstall", function () {
  console.log("Uninstall complete.");
  console.log("The service exists: ", svc.exists);
});

// Uninstall the service.
svc.uninstall();
