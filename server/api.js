
const ChangelogsCalls = new Mongo.Collection('changelogsCalls');

Router.route('/api/changelog', { where: 'server' })
  .post(function post() {
    if (!this.request.body || !this.request.body.versions) this.response.end('no body');

    const packages = this.request.body.versions.split('\n');
    const verbose = this.request.body.verbose || false;

    let tokens = [];

    ChangelogsCalls.insert({ createdAt: new Date(), packages: packages });

    packages.forEach((p) => {
      const pa = p.split('@');
      if (pa.length !== 2) return;
      const subtokens = changelog(pa[0], pa[1], verbose);
      if (subtokens) {
        const text = pa[0] + ' (local ' +  pa[1] + ')';
        tokens.push({ text, type: 'heading', depth: 1 });
        tokens = tokens.concat(subtokens);
      }
    });

    if (!tokens.length) tokens.push({ type: 'heading', depth: 1, text: 'Sorry, nothing new to show you!' });

    this.response.end(JSON.stringify(tokens));
  });
