// eslint-disable-next-line no-undef
module.exports = {
    parserPreset: {
        parserOpts: {
            headerPattern:
                /^(:\w+:) (feat|fix|docs|test|build|perf|style|refactor|chore|ci|raw|cleanup|remove): (.*)$/,
            headerCorrespondence: ["ignore", "type", "subject"],
        },
    },
    rules: {
        "type-enum": [
            2,
            "always",
            [
                "feat",
                "fix",
                "docs",
                "test",
                "build",
                "perf",
                "style",
                "refactor",
                "chore",
                "ci",
                "raw",
                "cleanup",
                "remove",
            ],
        ],
        "subject-empty": [2, "never"],
        "subject-max-length": [2, "always", 72],
    },
    extends: ["@commitlint/config-conventional"],
};
