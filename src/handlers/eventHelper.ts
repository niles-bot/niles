// package imports
const { DateTime } = require("luxon");
const debug = require("debug")("niles:event");

// event types
const eventType = {
  NOMATCH: "nm",
  SINGLE: "se",
  MULTISTART: "ms",
  MULTIMID: "mm",
  MULTYEND: "me"
};

/**
 * This function returns a classification of type 'eventType' to state the relation between a date and an event.
 * You can only check for the DAY relation, of checkDate, not the full dateTime relation!
 * @param {DateTime} checkDate - the Date to classify for an event
 * @param {DateTime} eventStartDate - the start Date() of an event
 * @param {DateTime} eventEndDate - the end Date() of an event
 * @return {string} eventType - A string of ENUM(eventType) representing the relation
 */
function classifyEventMatch(checkDate, eventStartDate, eventEndDate) {
  let eventMatchType = eventType.NOMATCH;
  // simple single day event
  if (checkDate.hasSame(eventStartDate, "day") && eventStartDate.hasSame(eventEndDate, "day")){
    eventMatchType = eventType.SINGLE;
  } else if (!eventStartDate.hasSame(eventEndDate, "day")) { // multi-day event
    // special case, Event ends as 12 AM spot on
    if (checkDate.hasSame(eventStartDate, "day") && eventEndDate.diff(eventStartDate.endOf("day"),"minutes") <= 1){
      eventMatchType = eventType.SINGLE;
    } else if (checkDate.hasSame(eventStartDate, "day")) {
      eventMatchType = eventType.MULTISTART;
    } else if (checkDate.hasSame(eventEndDate, "day")){
      eventMatchType = eventType.MULTYEND;
    } else if (checkDate.startOf("day") > eventStartDate.startOf("day")
      && checkDate.startOf("day") < eventEndDate.startOf("day")
      && eventEndDate.diff(checkDate.endOf("day"),"minutes") <= 1){
      // this makes the 12AM ending multi-day events show as ""..... - 12:00 AM"
      eventMatchType = eventType.MULTYEND;
    } else if (checkDate.startOf("day") > eventStartDate.startOf("day") && checkDate.startOf("day") < eventEndDate.startOf("day")){
      eventMatchType = eventType.MULTIMID;
    } 
  }
  // debug(`classifyEventMatch | type ${eventMatchType}`);
  return eventMatchType;
}

/**
 * Parses and corrects events for classification
 * @param {Date} day - Day to classify events agians
 * @param {Event} event - event to classify
 * @param {IANAZone} tz - timezone to align dates to 
 * @returns 
 */
function eventTimeCorrector(day, event, tz) {
  let eStartDate;
  let eEndDate;
  //Handle dateTime-based Events
  if (event.start.dateTime) {
    eStartDate = DateTime.fromISO(event.start.dateTime, {setZone: true});
    eEndDate = DateTime.fromISO(event.end.dateTime, {setZone: true});
  }
  //Handle All Day Events
  else if (event.start.date) {
    eStartDate = DateTime.fromISO(event.start.date, {zone: tz});
    // remove a day, since all-day end is start+1, we want to keep compatible with multi-day events though
    eEndDate = DateTime.fromISO(event.end.date, {zone: tz}).minus({days: 1});
  }
  // log(`Event to CEM: ${event.summary}`);
  return classifyEventMatch(day, eStartDate, eEndDate);
}

/**
 * this helper function strips all html formatting from the description.
 * @param {string} inputString - the unclean string
 * @return {string} strippedString - string stripped of html
 */
function descriptionParser(inputString) {
  if (!inputString) return "undefined";
  debug(`descriptionParser | pre: ${inputString}`);
  const brRegex = /(<br>)+/gi; // match <br>
  const htmlRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi; // html tags
  let cleanString;
  try { cleanString = decodeURI(inputString); } // decode URI
  catch(e) { cleanString = inputString; }
  return cleanString.replace(brRegex, "\n").replace(htmlRegex, "").trim(); // replace <br> with \n and stripped html tags
}

module.exports = {
  eventType,
  classifyEventMatch,
  eventTimeCorrector,
  descriptionParser
};
