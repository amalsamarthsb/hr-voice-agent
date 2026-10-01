function ProgressSteps({ currentStep }) {
  const steps = [
    "Setup & Resume",
    "System Check",
    "Live Interview",
  ];

  return (
    <div className="progress-container">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const completed = currentStep > stepNumber;
        const active = currentStep === stepNumber;

        return (
          <div className="progress-wrapper" key={label}>
            <div
              className={`progress-step ${
                active ? "active" : completed ? "completed" : ""
              }`}
            >
              <span className="progress-number">
                {completed ? "✓" : stepNumber}
              </span>

              <span className="progress-label">{label}</span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={`progress-line ${
                  currentStep > stepNumber ? "completed" : ""
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ProgressSteps;