# Contributing to Schwab Automated Trading System

Thank you for your interest in contributing! This project welcomes contributions from the community.

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug:

1. **Search existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear title describing the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Python version, OS, and relevant environment details
   - Log excerpts (remove sensitive data!)
   - Screenshots if applicable

### Suggesting Enhancements

Have an idea? Great! Please:

1. **Check existing issues/discussions** first
2. **Open an issue** describing:
   - The enhancement/feature
   - Use case and benefits
   - Possible implementation approach
   - Any alternatives considered

### Pull Requests

Ready to code? Awesome!

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Test thoroughly** (especially in paper trading mode)
5. **Commit with clear messages** (`git commit -m 'Add amazing feature'`)
6. **Push to your fork** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

#### PR Guidelines

- Describe what changes you made and why
- Reference any related issues
- Include test results (paper trading logs, etc.)
- Ensure code follows existing style
- Update documentation if needed
- Add your changes to CHANGELOG.md

## 📝 Code Style

- Follow PEP 8 conventions
- Use meaningful variable/function names
- Add docstrings to functions and classes
- Comment complex logic
- Keep functions focused and small

## 🧪 Testing

Before submitting:

1. **Test in paper mode** first
2. **Run for at least a few hours** to catch edge cases
3. **Check logs** for errors or warnings
4. **Verify risk limits** work correctly
5. **Test both with scanner and without**

## 🎯 Areas for Contribution

We especially welcome contributions in:

### High Priority
- Additional trading strategies
- Enhanced backtesting framework
- Performance optimizations
- Better error handling
- Improved logging and monitoring
- Unit tests

### Medium Priority
- Web dashboard for monitoring
- Additional technical indicators
- Machine learning integration
- Database storage for trades
- Mobile notifications
- Tax reporting tools

### Nice to Have
- TradingView integration
- Discord/Slack bots
- Additional broker support
- Portfolio analytics
- Risk parity algorithms
- Strategy optimizer

## 🚨 Important Notes

### Financial Responsibility

This is trading software dealing with real money. Please:

- **Test extensively** in paper mode before live trading
- **Never bypass risk limits** in your contributions
- **Document risks clearly** in new features
- **Prioritize safety** over performance
- **Consider edge cases** (market closed, API down, etc.)

### Code of Conduct

Be respectful, constructive, and professional. We're all here to learn and improve.

### Licensing

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🔍 Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/schwab-trading-app.git
cd schwab-trading-app

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Authenticate
python main.py --auth

# Test in paper mode
python main.py --mode paper
```

## 📚 Resources

- [Schwab API Documentation](https://developer.schwab.com)
- [QuantVue Methodology](https://docs.quantvue.io)
- [Python PEP 8 Style Guide](https://pep8.org)

## 💬 Questions?

- **Check the README** and documentation first
- **Search closed issues** for similar questions
- **Open a discussion** for general questions
- **Contact maintainers** for sensitive topics

## 🎉 Recognition

Contributors will be:
- Listed in README acknowledgments
- Credited in CHANGELOG for their contributions
- Forever appreciated by the community! 🙏

---

**Thank you for contributing to making this project better!** 🚀

Every contribution, no matter how small, helps improve the project for everyone.
