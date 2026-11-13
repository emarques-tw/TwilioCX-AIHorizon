// POST (form) { passcode } -> { records: [{ id, fields }] }
const lib = require(Runtime.getFunctions()['lib'].path);

exports.handler = async (context, event, callback) => {
  if (!lib.checkPasscode(context, event)) {
    return callback(null, lib.response(context, event, 401, { error: 'Unauthorized' }));
  }
  try {
    const records = await lib.listRecords(context);
    return callback(null, lib.response(context, event, 200, {
      records: records.map((r) => ({ id: r.id, createdTime: r.createdTime, fields: r.fields })),
    }));
  } catch (err) {
    console.error(err);
    return callback(null, lib.response(context, event, 500, { error: err.message }));
  }
};
