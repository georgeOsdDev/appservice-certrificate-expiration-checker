const { DefaultAzureCredential } = require("@azure/identity");
const { ResourceGraphClient } = require("@azure/arm-resourcegraph");

const credentials = new DefaultAzureCredential();
const client = new ResourceGraphClient(credentials);

const expireThreshold = process.env["expireThreshold"] || "90"; // days
const query = `Resources
| where subscriptionId == "${process.env["subscriptionId"]}"
| where type == "microsoft.certificateregistration/certificateorders"
| where properties["expirationTime"] < datetime_add("day", ${expireThreshold}, now())
| project id, resourceGroup, name, expirationTime=tostring(properties["expirationTime"]), distinguishedName=properties["distinguishedName"], provisioningState=properties["provisioningState"], autoRenew=properties["autoRenew"]
| order by expirationTime asc`;

module.exports = async function (context, myTimer) {
    context.log("Start to check App Service Certificates Expirination");
    try {
        const result = await client.resources({query},{ resultFormat: "table" });
        if (result.totalRecords > 0) {

            context.log.warn(`Found App Service Certificates Expiring in the next ${expireThreshold} days, Count: ${result.totalRecords}`);
            // Track avobe warning log with Application Insights Log Alert
            // https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/alerts-types#log-alerts
            //
            // traces
            // | where customDimensions.Category == "Function.DailyChecker.User"
            // | where customDimensions.LogLevel == "Warning"
            // | where message startswith "Found App Service Certificates Expiring in the next"

            result.data.forEach((row) => {
                context.log(`App Service Certificate is about to expire ${JSON.stringify(row)}`)
            });
        } else {
            context.log(`No App Service Certificate Expiring in the next ${expireThreshold} days`);
        }
    } catch (error) {
        context.log.error("Failed to execute query", error);
    }
    context.log("Finish to check App Service Certificates Expirination");
};
