"use client";
import React from "react";
import { Mail, Phone, MapPin } from "lucide-react";
import Link from "next/link";

const supportLinks = [
    { label: "Help Center", href: "#" },
    { label: "Contact Us", href: "#" },
    { label: "API Documentation", href: "#" },
    { label: "Status Page", href: "#" },
];

const companyLinks = [
    { label: "About Us", href: "/about" },
    { label: "Careers", href: "#" },
    { label: "Blog", href: "/blog" },
    { label: "Press Kit", href: "#" },
];

const legalLinks = [
    { label: "Privacy Policy", href: "/legal/privacy-policy" },
    { label: "Terms of Service", href: "/legal/terms-of-service" },
    { label: "Cookie Policy", href: "/legal/cookie-policy" },
    { label: "GDPR", href: "/legal/gdpr" },
];

const Footer = () => {
    return (
        <footer style={{ background: "var(--rl-surface)", borderTop: "1px solid var(--rl-border)" }}>
            <div className="rl-container" style={{ paddingTop: 64, paddingBottom: 32 }}>
                {/* Let's Contact heading */}
                <h2
                    className="rl-heading-2"
                    style={{ color: "var(--rl-text)", marginBottom: 48, fontSize: 28 }}
                >
                    Let&apos;s Contact
                </h2>

                {/* 4-Column Grid */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr",
                        gap: 40,
                    }}
                    className="rl-footer-grid"
                >
                    {/* Brand Column */}
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <span style={{ fontSize: 22, fontWeight: 700 }}>
                                <span style={{ color: "var(--rl-primary)" }}>Hire</span>
                                <span className="hh-wordmark">Heaven</span>
                            </span>
                        </div>
                        <p className="rl-small" style={{ color: "var(--rl-text-muted)", marginBottom: 20, maxWidth: 260 }}>
                            The modern job board platform that connects top talent with leading companies.
                            Streamline your hiring workflow today.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <span className="rl-small" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--rl-text-muted)" }}>
                                <Mail size={14} /> contact@hireheaven.com
                            </span>
                            <span className="rl-small" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--rl-text-muted)" }}>
                                <Phone size={14} /> +91 98765 43210
                            </span>
                            <span className="rl-small" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--rl-text-muted)" }}>
                                <MapPin size={14} /> Mumbai, India
                            </span>
                        </div>

                        {/* Social Icons */}
                        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                            {["X", "in", "fb"].map((icon) => (
                                <div
                                    key={icon}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        background: "var(--rl-muted)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "var(--rl-text-muted)",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    {icon}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Support */}
                    <div>
                        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: "var(--rl-text)" }}>
                            Support
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {supportLinks.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="rl-small"
                                    style={{ color: "var(--rl-text-muted)", textDecoration: "none", transition: "color 0.2s" }}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Company */}
                    <div>
                        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: "var(--rl-text)" }}>
                            Company
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {companyLinks.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="rl-small"
                                    style={{ color: "var(--rl-text-muted)", textDecoration: "none" }}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Legal */}
                    <div>
                        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: "var(--rl-text)" }}>
                            Legal
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {legalLinks.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="rl-small"
                                    style={{ color: "var(--rl-text-muted)", textDecoration: "none" }}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom bar */}
                <div
                    style={{
                        marginTop: 48,
                        paddingTop: 24,
                        borderTop: "1px solid var(--rl-border)",
                        textAlign: "center",
                    }}
                >
                    <p className="rl-small" style={{ color: "var(--rl-text-muted)" }}>
                        © 2025 HireHeaven. All rights reserved.
                    </p>
                </div>
            </div>

            <style jsx>{`
        @media (max-width: 768px) {
          .rl-footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 32px !important;
          }
        }
        @media (max-width: 480px) {
          .rl-footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
        </footer>
    );
};

export default Footer;
