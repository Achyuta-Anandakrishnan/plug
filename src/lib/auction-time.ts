const EST_OFFSET_MINUTES = -5 * 60;
const THURSDAY_INDEX = 4;
const NINE_PM_HOUR = 21;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

// Returns the next Thursday 9:00 PM EST (fixed UTC-5 offset).
export function nextThursdayNinePmEst(from = new Date()) {
  const estNow = new Date(from.getTime() + EST_OFFSET_MINUTES * 60_000);

  let daysUntilThursday = (THURSDAY_INDEX - estNow.getUTCDay() + 7) % 7;
  const isPastCutoffToday =
    daysUntilThursday === 0
    && (
      estNow.getUTCHours() > NINE_PM_HOUR
      || (
        estNow.getUTCHours() === NINE_PM_HOUR
        && (estNow.getUTCMinutes() > 0 || estNow.getUTCSeconds() > 0)
      )
    );
  if (isPastCutoffToday) {
    daysUntilThursday = 7;
  }

  const estCalendarAsUtc = Date.UTC(
    estNow.getUTCFullYear(),
    estNow.getUTCMonth(),
    estNow.getUTCDate() + daysUntilThursday,
    NINE_PM_HOUR,
    0,
    0,
    0,
  );

  return new Date(estCalendarAsUtc - EST_OFFSET_MINUTES * 60_000);
}

export function toDateTimeLocalInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
